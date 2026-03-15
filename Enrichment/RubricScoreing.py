#!/usr/bin/env python3
"""
Lead Enrichment Pipeline — Rubric-based scoring (Alder & Birch Legal, PLLC)
===========================================================================
Enriches prospect data in Supabase using Tavily search + Claude synthesis
with strict rubric-based fit/timing scores and fit_score_breakdown /
timing_score_breakdown columns.

Usage:
    python RubricScoreing.py                  # Interactive mode
    python RubricScoreing.py --count 5        # Process 5 prospects
    python RubricScoreing.py --count all      # Process all qualified prospects
    python RubricScoreing.py --prospect-id 42 # Process a single prospect by Primary Key
"""

import os
import sys
import json
import time
import argparse
import asyncio
from datetime import datetime, timezone
from typing import Optional

try:
    from supabase import create_client, Client
except ImportError:
    sys.exit("Missing: pip install supabase")

try:
    from tavily import TavilyClient
except ImportError:
    sys.exit("Missing: pip install tavily-python")

try:
    import anthropic
except ImportError:
    sys.exit("Missing: pip install anthropic")

try:
    from dotenv import load_dotenv
    _env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    load_dotenv(_env_path)
except ImportError:
    pass  # .env not loaded if python-dotenv not installed

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

TABLE_NAME = "BulkProspects"

# ICP pre-filter settings
MIN_EMPLOYEES = 25
MAX_EMPLOYEES = 200
TARGET_INDUSTRIES = [
    "saas", "software", "health", "healthcare", "healthtech", "health tech",
    "fintech", "financial", "finance", "e-commerce", "ecommerce",
    "information technology", "internet", "computer software",
    "medical", "insurance", "banking", "payments",
]
TARGET_KEYWORDS = [
    "saas", "software", "health", "fintech", "ecommerce", "e-commerce",
    "data", "cloud", "platform", "ai", "machine learning", "api",
    "payments", "insurance", "medical", "telehealth", "digital health",
]

# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        sys.exit("Set SUPABASE_URL and SUPABASE_KEY environment variables.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def _enrichment_status_column(sb: Client) -> Optional[str]:
    """Detect the actual enrichment_status column name (handles casing). Returns None if table empty or unreadable."""
    try:
        r = sb.table(TABLE_NAME).select("*").limit(1).execute()
        if not r.data or len(r.data) == 0:
            return None
        row = r.data[0]
        for key in ("enrichment_status", "Enrichment_Status", "EnrichmentStatus"):
            if key in row:
                return key
        lower = {k.lower(): k for k in row.keys()}
        return lower.get("enrichment_status")
    except Exception:
        return None


def fetch_prospects(sb: Client, count: Optional[int] = None, prospect_id: Optional[int] = None, status_col: Optional[str] = None):
    """Fetch prospects, optionally filtered. status_col is the enrichment_status column name (detected if not passed)."""
    if status_col is None:
        status_col = _enrichment_status_column(sb) or "enrichment_status"
    query = sb.table(TABLE_NAME).select("*")

    if prospect_id:
        query = query.eq("Primary", prospect_id)
    else:
        query = query.or_(f"{status_col}.is.null,{status_col}.eq.pending,{status_col}.eq.error")

    if count and not prospect_id:
        query = query.limit(count)

    result = query.execute()
    return result.data if result.data else []


def count_prospects(sb: Client, status_filter: Optional[str] = None, status_col: Optional[str] = None) -> int:
    """Count prospects, optionally filtered by enrichment status. status_col is the enrichment_status column name (detected if not passed)."""
    if status_col is None:
        status_col = _enrichment_status_column(sb) or "enrichment_status"
    query = sb.table(TABLE_NAME).select("*", count="exact")
    if status_filter == "pending":
        query = query.or_(f"{status_col}.is.null,{status_col}.eq.pending,{status_col}.eq.error")
    elif status_filter:
        query = query.eq(status_col, status_filter)
    query = query.limit(0)
    result = query.execute()
    return result.count if result.count else 0


def write_enrichment(sb: Client, primary_key: int, enrichment: dict, status_col: str = "enrichment_status"):
    """Write enrichment data back to Supabase."""
    enrichment["enriched_at"] = datetime.now(timezone.utc).isoformat()
    enrichment[status_col] = "enriched"
    sb.table(TABLE_NAME).update(enrichment).eq("Primary", primary_key).execute()


# ---------------------------------------------------------------------------
# Pre-filtering
# ---------------------------------------------------------------------------

def passes_prefilter(prospect: dict) -> tuple[bool, list[str]]:
    """
    Check if a prospect passes basic ICP filters using existing data.
    Returns (passes, reasons_for_skip).
    """
    reasons = []

    # Employee count filter
    emp = prospect.get("# Employees")
    if emp is not None:
        if emp < MIN_EMPLOYEES:
            reasons.append(f"Too small ({emp} employees, min {MIN_EMPLOYEES})")
        elif emp > MAX_EMPLOYEES:
            reasons.append(f"Too large ({emp} employees, max {MAX_EMPLOYEES})")

    # Industry/keywords filter
    industry = (prospect.get("Industry") or "").lower()
    keywords = (prospect.get("Keywords") or "").lower()
    combined = f"{industry} {keywords}"

    has_industry_match = any(t in combined for t in TARGET_INDUSTRIES)
    has_keyword_match = any(t in combined for t in TARGET_KEYWORDS)

    if not has_industry_match and not has_keyword_match:
        # If we have industry/keyword data and none match, flag it
        if industry or keywords:
            reasons.append(f"Industry mismatch: {industry or 'unknown'}")

    # Funding filter — should have raised something
    funding = prospect.get("Total Funding")
    latest = prospect.get("Latest Funding")
    if funding is not None and funding == 0 and not latest:
        reasons.append("No funding history")

    passes = len(reasons) == 0
    return passes, reasons


# ---------------------------------------------------------------------------
# Tavily research
# ---------------------------------------------------------------------------

def build_search_queries(prospect: dict) -> list[dict]:
    """
    Build targeted Tavily search queries for a prospect.
    Returns list of {query, purpose} dicts.
    """
    company = prospect.get("Company Name", "")
    website = prospect.get("Website", "")
    name = f"{prospect.get('First Name', '')} {prospect.get('Last Name', '')}".strip()
    industry = prospect.get("Industry", "")

    # Clean up website for query use
    domain = website.replace("https://", "").replace("http://", "").rstrip("/") if website else ""

    queries = []

    # Query 1: Company overview + privacy/compliance posture
    q1 = f"{company} {domain} privacy policy data compliance SOC 2"
    queries.append({
        "query": q1,
        "purpose": "privacy_posture",
        "search_depth": "advanced",
    })

    # Query 2: Recent news — funding, expansion, product launches
    q2 = f"{company} {domain} funding expansion launch 2025 2026"
    queries.append({
        "query": q2,
        "purpose": "recent_signals",
        "search_depth": "advanced",
    })

    # Query 3: Data breach history
    q3 = f"{company} {domain} data breach incident security"
    queries.append({
        "query": q3,
        "purpose": "breach_check",
        "search_depth": "basic",
    })

    # Query 4: Hiring signals — legal, compliance, DPO roles
    q4 = f"{company} hiring head of legal compliance privacy officer DPO"
    queries.append({
        "query": q4,
        "purpose": "hiring_signals",
        "search_depth": "basic",
    })

    return queries


def run_tavily_searches(tavily: TavilyClient, queries: list[dict]) -> list[dict]:
    """Execute Tavily searches and return structured results."""
    results = []
    for q in queries:
        try:
            response = tavily.search(
                query=q["query"],
                search_depth=q.get("search_depth", "basic"),
                max_results=5,
                include_answer=True,
                include_raw_content=False,
            )
            results.append({
                "purpose": q["purpose"],
                "query": q["query"],
                "answer": response.get("answer", ""),
                "results": [
                    {
                        "title": r.get("title", ""),
                        "url": r.get("url", ""),
                        "content": r.get("content", ""),
                        "score": r.get("score", 0),
                    }
                    for r in response.get("results", [])
                ],
            })
        except Exception as e:
            results.append({
                "purpose": q["purpose"],
                "query": q["query"],
                "error": str(e),
                "results": [],
            })
        # Brief pause to respect rate limits
        time.sleep(0.3)
    return results


# ---------------------------------------------------------------------------
# Claude synthesis
# ---------------------------------------------------------------------------

SYNTHESIS_SYSTEM_PROMPT = """You are a research analyst for Alder & Birch Legal, PLLC — a boutique data privacy and compliance law firm based in Austin, TX. The firm helps fast-growing tech companies with privacy program buildouts, regulatory compliance (CCPA, GDPR, HIPAA, SOC 2, state privacy laws), incident response, and product counsel.

Your job is to analyze research data about a prospect company and produce a structured enrichment assessment using STRICT, EVIDENCE-BASED scoring. You must earn every point with concrete evidence from the research results or the prospect's existing data. Do NOT assume, infer, or give credit for things not explicitly supported by evidence.

CRITICAL SCORING RULES:
- Every point must be justified by specific evidence. "They are a SaaS company so they probably handle PII" is NOT evidence. You need proof.
- If Tavily returned nothing relevant for a category, that category scores 0. Do not guess.
- Most companies should score 4-6 overall. A score of 8+ means multiple strong, concrete, recent signals were found. This should be rare.
- An absence of evidence is NOT evidence of absence, but it IS a reason to score conservatively.

=== FIT SCORE (start at 0, add points with evidence) ===

+2 points: Company is confirmed SaaS, healthtech, fintech, or e-commerce
   Evidence needed: Industry classification, product description, or website confirms this. Not just "technology company."

+2 point: Handles sensitive data (health/HIPAA, financial, biometric, children's/COPPA)
   Evidence needed: Product description, privacy policy, or research explicitly mentions handling these data types. NOT assumed from industry alone.

+2 point: No existing privacy counsel or in-house legal team detected
   Evidence needed: No mention of General Counsel, privacy team, or outside privacy firm found in research. If a legal hire was JUST made, this still counts (they're new and finding gaps).

+1 point: Employee count is 25-200
   Evidence needed: From prospect data (# Employees field).

+1 point: Raised at least a Seed round
   Evidence needed: From prospect data (Total Funding, Latest Funding fields) or research confirms funding.

+1 point: B2B with enterprise customers or actively pursuing enterprise sales
   Evidence needed: Enterprise pricing page, SOC 2 badge on website, case studies with enterprise logos, or job postings mentioning enterprise sales.

+1 point: Product involves collecting/processing user PII at scale
   Evidence needed: Product description or research shows they collect personal data from end users (not just internal employee data).

+1 point: Company is in active growth phase
   Evidence needed: Recent job postings, press about expansion, new product launches, or headcount growth found in research.

=== TIMING SCORE (start at 0, add points with evidence) ===

+5 points: Active data breach or recent security incident within the last 3 months
   Evidence needed: News article, state AG database entry, HHS breach portal, or company disclosure found. Must cite source.

+5 points: New state privacy law affecting them takes effect within 6 months
   Evidence needed: Evidence they have users in a state with upcoming privacy law deadlines (Texas, Oregon, Montana, etc.).

+3 points: Expanding into EU/UK (GDPR trigger)
   Evidence needed: Job posting for EU-based roles, international office announcement, GDPR-related job descriptions, or press about European expansion.

+3 point: Launching product features involving sensitive data collection
   Evidence needed: Product launch announcement, feature release, or press about new data collection capabilities.

+2 points: Raised funding in the last 6 months
   Evidence needed: Dated funding announcement found in research. The date matters — funding from 2+ years ago scores 0 here.

+2 points: Hired or actively hiring Head of Legal, DPO, VP Compliance, or similar
   Evidence needed: Job posting or LinkedIn announcement found in research.

+1 point: Enterprise deal activity or compliance pressure
   Evidence needed: Job postings mentioning SOC 2 or compliance, press about enterprise customers, or RFP/procurement activity.

=== OVERALL SCORE ===
Calculate as: round((fit_score + timing_score) / 2)
This means a perfect score requires BOTH strong fit AND hot timing. A great fit (8) with no timing (2) = overall 5. This is correct and intentional.

=== CONTACT ROLE FIT ===
9-10: CEO, CTO, General Counsel, Head of Legal, Chief Privacy Officer, DPO
7-8: VP Engineering, VP Product, VP Compliance, COO, CFO
5-6: Director-level in engineering, product, or operations
3-4: Manager-level or senior individual contributor
1-2: Individual contributor, marketing, sales, HR, or unrelated role

=== URGENCY LEVELS ===
"immediate": Active breach, regulatory deadline within 60 days, or evidence of a deal-blocking compliance gap RIGHT NOW
"near-term": Trigger event found within the last 3 months (funding, hiring, expansion)
"future": General ICP fit but no concrete recent trigger event found

You must respond ONLY with valid JSON matching the schema below. No markdown, no explanation outside the JSON."""

SYNTHESIS_USER_TEMPLATE = """Analyze this prospect using the strict checklist scoring rubric. Award points ONLY where you have concrete evidence.

PROSPECT DATA:
- Company: {company_name}
- Contact: {first_name} {last_name}, {title}
- Industry: {industry}
- Keywords: {keywords}
- Employees: {employees}
- Website: {website}
- Location: {city}, {state}, {country}
- Total Funding: {total_funding}
- Latest Funding: {latest_funding}
- Latest Funding Amount: {latest_funding_amount}
- Last Raised At: {last_raised}
- Annual Revenue: {annual_revenue}

RESEARCH RESULTS:
{research_json}

Score each checklist item and show your work in fit_score_breakdown and timing_score_breakdown. Each entry should state the criterion and whether it was met with what evidence (or "NOT MET — no evidence found").

Respond with this exact JSON structure:
{{
    "fit_score": <0+>,
    "fit_score_breakdown": [
        {{"criterion": "<what was checked>", "points": <points for this criterion>, "evidence": "<specific evidence or 'NOT MET — reason'>"}}
    ],
    "timing_score": <0+>,
    "timing_score_breakdown": [
        {{"criterion": "<what was checked>", "points": <points for this criterion>, "evidence": "<specific evidence or 'NOT MET — reason'>"}}
    ],
    "overall_score": <0+>,
    "contact_role_fit": <1-10>,
    "icp_company_type": "<saas|healthtech|fintech|ecommerce|other>",
    "icp_match_reasons": ["reason1", "reason2"],
    "sensitive_data_categories": ["category1", "category2"],
    "compliance_needs": ["GDPR", "CCPA", "HIPAA", "SOC2", "COPPA", "state_privacy"],
    "buy_signals": [
        {{"type": "<signal_type>", "evidence": "<what was found>", "source_url": "<url or null>"}}
    ],
    "trigger_events": [
        {{"type": "<event_type>", "date": "<date or null>", "description": "<what happened>", "source": "<url or null>"}}
    ],
    "urgency_level": "<immediate|near-term|future>",
    "current_privacy_posture": "<assessment of their current privacy stance>",
    "privacy_gaps": ["gap1", "gap2"],
    "competitor_signals": [
        {{"type": "<signal>", "detail": "<what was found>"}}
    ],
    "breach_flag": <true|false>,
    "breach_details": {{"date": "<date or null>", "scope": "<description or null>", "data_types": ["type1"], "source": "<url or null>", "regulatory_status": "<status or null>"}},
    "risk_factors": ["risk1", "risk2"],
    "research_summary": "<2-3 paragraph synthesis of the company, their privacy needs, and the opportunity>",
    "outreach_angle": "<2-3 sentence recommended approach for a partner to use in outreach>",
    "recommended_contact_approach": "<direct|loop_in_legal|loop_in_cto|loop_in_compliance>"
}}"""


def synthesize_with_claude(
    client: anthropic.Anthropic,
    prospect: dict,
    research_results: list[dict],
) -> dict:
    """Send prospect + research to Claude for synthesis."""
    user_msg = SYNTHESIS_USER_TEMPLATE.format(
        company_name=prospect.get("Company Name", "Unknown"),
        first_name=prospect.get("First Name", ""),
        last_name=prospect.get("Last Name", ""),
        title=prospect.get("Title", "Unknown"),
        industry=prospect.get("Industry", "Unknown"),
        keywords=prospect.get("Keywords", ""),
        employees=prospect.get("# Employees", "Unknown"),
        website=prospect.get("Website", ""),
        city=prospect.get("City", ""),
        state=prospect.get("State", ""),
        country=prospect.get("Country", ""),
        total_funding=prospect.get("Total Funding", "Unknown"),
        latest_funding=prospect.get("Latest Funding", "Unknown"),
        latest_funding_amount=prospect.get("Latest Funding Amount", "Unknown"),
        last_raised=prospect.get("Last Raised At", "Unknown"),
        annual_revenue=prospect.get("Annual Revenue", "Unknown"),
        research_json=json.dumps(research_results, indent=2),
    )

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYNTHESIS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw_text = response.content[0].text.strip()

    # Clean potential markdown fences
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3]
    raw_text = raw_text.strip()

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as e:
        print(f"      ⚠️  JSON parse error: {e}")
        print(f"      Raw response (first 500 chars): {raw_text[:500]}")
        return {"error": f"JSON parse failed: {str(e)}", "raw_response": raw_text[:1000]}


# ---------------------------------------------------------------------------
# Pipeline orchestration
# ---------------------------------------------------------------------------

def process_prospect(
    prospect: dict,
    tavily: TavilyClient,
    claude: anthropic.Anthropic,
    sb: Client,
    dry_run: bool = False,
    status_col: Optional[str] = None,
) -> dict:
    """Run the full enrichment pipeline for a single prospect."""
    if status_col is None:
        status_col = _enrichment_status_column(sb) or "enrichment_status"
    pk = prospect["Primary"]
    company = prospect.get("Company Name", "Unknown")
    name = f"{prospect.get('First Name', '')} {prospect.get('Last Name', '')}".strip()

    print(f"\n{'='*60}")
    print(f"   📋 {company}")
    print(f"   👤 {name} — {prospect.get('Title', 'N/A')}")
    print(f"   🏢 {prospect.get('# Employees', '?')} employees | {prospect.get('Industry', 'N/A')}")
    print(f"   💰 Funding: {prospect.get('Latest Funding', 'N/A')} — ${prospect.get('Latest Funding Amount', '?')}")
    print(f"{'='*60}")

    # Step 1: Pre-filter
    passes, skip_reasons = passes_prefilter(prospect)
    if not passes:
        print(f"   ⏭️  Skipped (pre-filter): {'; '.join(skip_reasons)}")
        if not dry_run:
            sb.table(TABLE_NAME).update({
                status_col: "skipped",
                "risk_factors": json.dumps(skip_reasons),
                "enriched_at": datetime.now(timezone.utc).isoformat(),
            }).eq("Primary", pk).execute()
        return {"status": "skipped", "reasons": skip_reasons}

    # Step 2: Tavily research
    print(f"   🔍 Running Tavily searches...")
    queries = build_search_queries(prospect)
    research_results = run_tavily_searches(tavily, queries)

    search_count = sum(len(r.get("results", [])) for r in research_results)
    error_count = sum(1 for r in research_results if "error" in r)
    print(f"   📊 Found {search_count} results across {len(queries)} queries ({error_count} errors)")

    # Step 3: Claude synthesis
    print(f"   🧠 Synthesizing with Claude...")
    synthesis = synthesize_with_claude(claude, prospect, research_results)

    if "error" in synthesis:
        print(f"   ❌ Synthesis failed: {synthesis['error']}")
        if not dry_run:
            sb.table(TABLE_NAME).update({
                status_col: "error",
                "raw_research": json.dumps(research_results),
                "enriched_at": datetime.now(timezone.utc).isoformat(),
            }).eq("Primary", pk).execute()
        return {"status": "error", "error": synthesis["error"]}

    # Step 4: Write back to Supabase
    enrichment = {
        "fit_score": synthesis.get("fit_score"),
        "fit_score_breakdown": json.dumps(synthesis.get("fit_score_breakdown", [])),
        "timing_score": synthesis.get("timing_score"),
        "timing_score_breakdown": json.dumps(synthesis.get("timing_score_breakdown", [])),
        "overall_score": synthesis.get("overall_score"),
        "contact_role_fit": synthesis.get("contact_role_fit"),
        "icp_company_type": synthesis.get("icp_company_type"),
        "icp_match_reasons": json.dumps(synthesis.get("icp_match_reasons", [])),
        "sensitive_data_categories": json.dumps(synthesis.get("sensitive_data_categories", [])),
        "compliance_needs": json.dumps(synthesis.get("compliance_needs", [])),
        "buy_signals": json.dumps(synthesis.get("buy_signals", [])),
        "trigger_events": json.dumps(synthesis.get("trigger_events", [])),
        "urgency_level": synthesis.get("urgency_level"),
        "current_privacy_posture": synthesis.get("current_privacy_posture"),
        "privacy_gaps": json.dumps(synthesis.get("privacy_gaps", [])),
        "competitor_signals": json.dumps(synthesis.get("competitor_signals", [])),
        "breach_flag": synthesis.get("breach_flag", False),
        "breach_details": json.dumps(synthesis.get("breach_details", {})),
        "risk_factors": json.dumps(synthesis.get("risk_factors", [])),
        "research_summary": synthesis.get("research_summary"),
        "outreach_angle": synthesis.get("outreach_angle"),
        "recommended_contact_approach": synthesis.get("recommended_contact_approach"),
        "raw_research": json.dumps(research_results),
    }

    # Print summary
    fit = synthesis.get("fit_score", "?")
    timing = synthesis.get("timing_score", "?")
    overall = synthesis.get("overall_score", "?")
    urgency = synthesis.get("urgency_level", "?")
    breach = "🚨 YES" if synthesis.get("breach_flag") else "No"

    print(f"\n   📈 Scores: Fit={fit} | Timing={timing} | Overall={overall}")
    print(f"   ⏰ Urgency: {urgency}")
    print(f"   🔓 Breach: {breach}")

    # Show fit score breakdown
    fit_breakdown = synthesis.get("fit_score_breakdown", [])
    if fit_breakdown:
        print(f"\n   🎯 Fit Breakdown (total: {fit}):")
        for item in fit_breakdown:
            pts = item.get("points", 0)
            icon = "✅" if pts > 0 else "❌"
            crit = item.get("criterion", "?")[:45]
            print(f"      {icon} +{pts}  {crit}")

    # Show timing score breakdown
    timing_breakdown = synthesis.get("timing_score_breakdown", [])
    if timing_breakdown:
        print(f"\n   ⏱️  Timing Breakdown (total: {timing}):")
        for item in timing_breakdown:
            pts = item.get("points", 0)
            icon = "✅" if pts > 0 else "❌"
            crit = item.get("criterion", "?")[:45]
            print(f"      {icon} +{pts}  {crit}")

    print(f"\n   💬 Outreach Angle:")
    angle = synthesis.get("outreach_angle", "N/A")
    for line in _wrap_text(angle, 55):
        print(f"      {line}")

    if not dry_run:
        write_enrichment(sb, pk, enrichment, status_col=status_col)
        print(f"\n   ✅ Written to Supabase.")
    else:
        print(f"\n   🏷️  Dry run — not written.")

    return {"status": "enriched", "synthesis": synthesis}


def _wrap_text(text: str, width: int) -> list[str]:
    """Simple word wrap."""
    words = text.split()
    lines, current = [], ""
    for word in words:
        if len(current) + len(word) + 1 > width:
            lines.append(current)
            current = word
        else:
            current = f"{current} {word}".strip()
    if current:
        lines.append(current)
    return lines


# ---------------------------------------------------------------------------
# Interactive CLI
# ---------------------------------------------------------------------------

def print_banner():
    print("""
╔══════════════════════════════════════════════════════════════╗
║     ALDER & BIRCH — Rubric Scoring Enrichment Pipeline      ║
║              Tavily + Claude (strict rubric)                 ║
╚══════════════════════════════════════════════════════════════╝
    """)


def interactive_mode(sb: Client, tavily: TavilyClient, claude: anthropic.Anthropic):
    """Interactive CLI for running the pipeline."""
    print_banner()

    # Count prospects (detects enrichment_status column name from first row)
    total_count = count_prospects(sb)
    status_col = _enrichment_status_column(sb) or "enrichment_status"
    pending_count = count_prospects(sb, status_filter="pending", status_col=status_col)
    enriched_count = count_prospects(sb, status_filter="enriched", status_col=status_col)

    print(f"📊 Database Status:")
    print(f"   Total prospects:    {total_count}")
    print(f"   Pending enrichment: {pending_count}")
    print(f"   Already enriched:   {enriched_count}")

    if total_count == 0:
        print("\n   💡 If the table has rows in Supabase, enable SELECT for your key (e.g. turn off RLS or add a policy).")

    if pending_count == 0:
        print("\n✨ All prospects have been processed!")
        resp = input("   Reset all to 'pending' and re-run? (y/n): ").strip().lower()
        if resp == "y":
            sb.table(TABLE_NAME).update({status_col: "pending"}).neq(
                status_col, "never_existed_value"
            ).execute()
            print("   🔄 Reset complete.")
            pending_count = count_prospects(sb, status_filter="pending", status_col=status_col)
        else:
            return

    # Ask how many to process
    print(f"\nHow many prospects to process?")
    print(f"   1-9   = that many (good for testing)")
    print(f"   all   = all {pending_count} pending prospects")
    print(f"   q     = quit")

    choice = input("\n> ").strip().lower()
    if choice == "q":
        return
    elif choice == "all":
        count = None  # No limit
    else:
        try:
            count = int(choice)
            if count < 1 or count > 9:
                print("Invalid input. Enter 1-9, 'all', or 'q'.")
                return
        except ValueError:
            print("Invalid input. Enter 1-9, 'all', or 'q'.")
            return

    # Fetch prospects
    prospects = fetch_prospects(sb, count=count, status_col=status_col)
    print(f"\n🎯 Loaded {len(prospects)} prospects to process.\n")

    if not prospects:
        print("No prospects to process. (There are no rows with pending/null/error enrichment status, or the table is empty.)")
        return

    # Process
    stats = {"enriched": 0, "skipped": 0, "error": 0}
    start_time = time.time()

    for i, prospect in enumerate(prospects, 1):
        print(f"\n[{i}/{len(prospects)}]", end="")
        result = process_prospect(prospect, tavily, claude, sb, status_col=status_col)
        stats[result["status"]] = stats.get(result["status"], 0) + 1

        if i < len(prospects):
            time.sleep(1)

    elapsed = time.time() - start_time

    # Summary
    print(f"\n\n{'='*60}")
    print(f"   ✅ RUBRIC SCORING COMPLETE")
    print(f"{'='*60}")
    print(f"   Enriched: {stats['enriched']}")
    print(f"   Skipped:  {stats['skipped']}")
    print(f"   Errors:   {stats['error']}")
    print(f"   Time:     {elapsed:.1f}s ({elapsed/max(len(prospects),1):.1f}s per prospect)")
    print(f"{'='*60}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Lead Enrichment Pipeline — Rubric Scoring")
    parser.add_argument("--count", type=str, help="Number of prospects to process (or 'all')")
    parser.add_argument("--prospect-id", type=int, help="Process a single prospect by Primary Key")
    parser.add_argument("--dry-run", action="store_true", help="Run without writing to Supabase")
    args = parser.parse_args()

    # Validate API keys
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_KEY:
        missing.append("SUPABASE_KEY")
    if not TAVILY_API_KEY:
        missing.append("TAVILY_API_KEY")
    if not ANTHROPIC_API_KEY:
        missing.append("ANTHROPIC_API_KEY")

    if missing:
        print("❌ Missing environment variables:")
        for m in missing:
            print(f"   export {m}=<your-key>")
        sys.exit(1)

    # Initialize clients
    sb = get_supabase_client()
    tavily = TavilyClient(api_key=TAVILY_API_KEY)
    claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    if args.prospect_id:
        # Single prospect mode
        prospects = fetch_prospects(sb, prospect_id=args.prospect_id)
        if not prospects:
            print(f"❌ No prospect found with Primary = {args.prospect_id}")
            return
        process_prospect(prospects[0], tavily, claude, sb, dry_run=args.dry_run)
    elif args.count:
        # Batch mode from CLI
        count = None if args.count == "all" else int(args.count)
        prospects = fetch_prospects(sb, count=count)
        print(f"🎯 Processing {len(prospects)} prospects...")
        for i, p in enumerate(prospects, 1):
            print(f"\n[{i}/{len(prospects)}]", end="")
            process_prospect(p, tavily, claude, sb, dry_run=args.dry_run)
            if i < len(prospects):
                time.sleep(1)
    else:
        # Interactive mode
        interactive_mode(sb, tavily, claude)


if __name__ == "__main__":
    main()
