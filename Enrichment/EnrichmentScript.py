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

# Minimum overall_score required to draft an outreach email
EMAIL_DRAFT_MIN_SCORE = 6


def _load_prompt_from_file(filename: str, default: str) -> str:
    """
    Load a prompt string from a plain text file in the same directory.
    Falls back to the provided default on any error.
    """
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(base_dir, filename)
        if not os.path.exists(path):
            return default
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"   ⚠️  Failed to load {filename}: {e}")
        return default

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


def _call_claude_with_retry(
    client: anthropic.Anthropic,
    *,
    max_attempts: int = 3,
    initial_delay: float = 2.0,
    **kwargs,
):
    """
    Call Claude with simple retry logic for transient overload errors.

    Retries when we detect HTTP 529 or an error payload with type=overloaded_error.
    """
    attempt = 0
    delay = initial_delay
    while True:
        attempt += 1
        try:
            return client.messages.create(**kwargs)
        except Exception as e:  # anthropic's errors subclass Exception
            # Try to detect overloaded / 529 conditions
            status_code = getattr(e, "status_code", None)
            body = getattr(e, "body", None)
            error_type = None

            if isinstance(body, dict):
                # Newer Anthropic SDKs wrap error details like {"type": "...", "error": {...}}
                if isinstance(body.get("error"), dict):
                    error_type = body["error"].get("type") or body.get("type")
                else:
                    error_type = body.get("type")

            is_overloaded = status_code == 529 or error_type == "overloaded_error"

            if not is_overloaded or attempt >= max_attempts:
                print(f"      ❌ Claude call failed (attempt {attempt}/{max_attempts}): {e}")
                raise

            print(
                f"      ⚠️ Claude overloaded (attempt {attempt}/{max_attempts}, "
                f"status={status_code}, type={error_type}). Retrying in {delay:.1f}s..."
            )
            time.sleep(delay)
            delay *= 1.5


# Load prompts from external text files in the same directory
SYNTHESIS_SYSTEM_PROMPT = _load_prompt_from_file(
    "synthesis_system_prompt.txt",
    "SYNTHESIS_SYSTEM_PROMPT missing. Create synthesis_system_prompt.txt next to RubricScoreing.py.",
)
SYNTHESIS_USER_TEMPLATE = _load_prompt_from_file(
    "synthesis_user_template.txt",
    "SYNTHESIS_USER_TEMPLATE missing. Create synthesis_user_template.txt next to RubricScoreing.py.",
)


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

    response = _call_claude_with_retry(
        client,
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
# Email drafting with Claude
# ---------------------------------------------------------------------------

def draft_outreach_email(
    client: anthropic.Anthropic,
    prospect: dict,
    synthesis: dict,
    company_profile: dict,
) -> dict:
    """
    Draft a personalized outreach email using Claude.
    Returns {"subject": str, "body": str, "service_line": str} or {"error": ...}.
    """
    try:
        sender = company_profile.get("sender", {})
        company = company_profile.get("company", {})
        guidelines = company_profile.get("email_guidelines", {})

        tone_rules = "\n".join(f"- {t}" for t in guidelines.get("tone", []))
        structure_rules = "\n".join(f"- {s}" for s in guidelines.get("structure", []))
        avoid_rules = "\n".join(f"- {a}" for a in guidelines.get("things_to_avoid", []))
        example_openings = "\n".join(f"- {e}" for e in guidelines.get("example_openings", []))

        services = company.get("services", [])
        services_text_lines = []
        for s in services:
            services_text_lines.append(
                f"- {s.get('name')}: {s.get('description')} "
                f"(best for: {s.get('best_for')})"
            )
        services_text = "\n".join(services_text_lines)

        differentiators = "\n".join(
            f"- {d}" for d in company.get("differentiators", [])
        )

        system_prompt = (
            f"You are writing a cold outreach email on behalf of {sender.get('name', 'a partner')}, "
            f"{sender.get('title', 'Partner')} at {company.get('name', 'Alder & Birch Legal, PLLC')}.\n\n"
            f"Sender bio:\n{sender.get('bio', '')}\n\n"
            "Email tone guidelines:\n"
            f"{tone_rules}\n\n"
            "Email structure template:\n"
            f"{structure_rules}\n\n"
            "Things to avoid:\n"
            f"{avoid_rules}\n\n"
            "Example openings (for style, do not copy verbatim):\n"
            f"{example_openings}\n\n"
            "Firm services (service lines):\n"
            f"{services_text}\n\n"
            "Firm differentiators:\n"
            f"{differentiators}\n\n"
            "Requirements:\n"
            "- Pick ONE most relevant service line to lead with based on the prospect's signals.\n"
            "- The body must be plain text (no HTML, no markdown), ready to paste into an email client.\n"
            "- The body must be at most 150 words (4–6 sentences).\n"
            "- Do not mention pricing or fees.\n"
            "- Do not mention any automated research, enrichment pipeline, or AI tools.\n"
            "- Reference research signals subtly (e.g., 'I noticed you recently raised...' not exact amounts/dates).\n"
            "- Use the provided outreach_angle as guidance but write the email fresh.\n"
            'Respond ONLY in valid JSON with this shape (no markdown, no extra text): '
            '{"subject": "...", "body": "...", "service_line": "..."}'
        )

        # Build user message with prospect + synthesis context
        user_payload = {
            "prospect_name": f"{prospect.get('First Name', '')} {prospect.get('Last Name', '')}".strip(),
            "prospect_title": prospect.get("Title", ""),
            "prospect_company": prospect.get("Company Name", ""),
            "research_summary": synthesis.get("research_summary"),
            "outreach_angle": synthesis.get("outreach_angle"),
            "buy_signals": synthesis.get("buy_signals", []),
            "trigger_events": synthesis.get("trigger_events", []),
            "urgency_level": synthesis.get("urgency_level"),
            "compliance_needs": synthesis.get("compliance_needs", []),
            "sensitive_data_categories": synthesis.get("sensitive_data_categories", []),
            "privacy_gaps": synthesis.get("privacy_gaps", []),
            "breach_flag": synthesis.get("breach_flag", False),
            "contact_role_fit": synthesis.get("contact_role_fit"),
        }

        user_msg = (
            "Use the following context to write the email.\n\n"
            f"CONTEXT (JSON):\n{json.dumps(user_payload, indent=2)}\n"
        )

        response = _call_claude_with_retry(
            client,
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
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
            parsed = json.loads(raw_text)
        except json.JSONDecodeError as e:
            print(f"      ⚠️  Email JSON parse error: {e}")
            print(f"      Raw email response (first 500 chars): {raw_text[:500]}")
            return {"error": f"Email JSON parse failed: {str(e)}", "raw_response": raw_text[:1000]}

        # Normalize keys
        subject = parsed.get("subject")
        body = parsed.get("body")
        service_line = parsed.get("service_line")

        if not subject or not body or not service_line:
            return {
                "error": "Email response missing required fields",
                "raw_response": raw_text[:1000],
            }

        # Brief pause to respect rate limits (separate from Tavily)
        time.sleep(0.3)

        return {
            "subject": subject,
            "body": body,
            "service_line": service_line,
        }
    except Exception as e:
        return {"error": f"Email drafting failed: {str(e)}"}


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
    company_profile: Optional[dict] = None,
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

    # Step 4: Optional email drafting (for high-scoring prospects)
    email_subject = None
    email_body = None
    email_service_line = None

    overall_score = synthesis.get("overall_score")
    if company_profile is not None and isinstance(overall_score, (int, float)) and overall_score >= EMAIL_DRAFT_MIN_SCORE:
        print("   ✉️  Drafting outreach email...")
        email_result = draft_outreach_email(claude, prospect, synthesis, company_profile)
        if "error" in email_result:
            print(f"      ⚠️  Email drafting failed: {email_result['error']}")
        else:
            email_subject = email_result.get("subject")
            email_body = email_result.get("body")
            email_service_line = email_result.get("service_line")

    # Step 5: Write back to Supabase
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
        "email_draft_subject": email_subject,
        "email_draft_body": email_body,
        "email_draft_service_line": email_service_line,
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

    # Print email draft preview (if available)
    if email_subject and email_body:
        print(f"\n   ✉️  Email Draft Subject: {email_subject}")
        preview = (email_body[:100] + "...") if len(email_body) > 100 else email_body
        print("   ✉️  Email Draft Preview:")
        for line in _wrap_text(preview, 70):
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
║     ALDER & BIRCH — Rubric Scoring Enrichment Pipeline       ║
║              Tavily + Claude (strict rubric)                 ║
╚══════════════════════════════════════════════════════════════╝
    """)


def interactive_mode(sb: Client, tavily: TavilyClient, claude: anthropic.Anthropic, company_profile: Optional[dict] = None):
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
    print(f"   70    = process 70 prospects")
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
            # Allow 1-9 for quick tests and 70 for a larger batch run
            if count not in range(1, 10) and count != 70:
                print("Invalid input. Enter 1-9, '70', 'all', or 'q'.")
                return
        except ValueError:
            print("Invalid input. Enter 1-9, '70', 'all', or 'q'.")
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
        result = process_prospect(prospect, tavily, claude, sb, status_col=status_col, company_profile=company_profile)
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

    # Load company profile for email drafting (optional)
    company_profile = None
    try:
        profile_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "company_profile.json")
        if os.path.exists(profile_path):
            with open(profile_path, "r", encoding="utf-8") as f:
                company_profile = json.load(f)
        else:
            print("   ⚠️  company_profile.json not found. Email drafting will be skipped.")
    except Exception as e:
        print(f"   ⚠️  Failed to load company_profile.json: {e}")
        company_profile = None

    if args.prospect_id:
        # Single prospect mode
        prospects = fetch_prospects(sb, prospect_id=args.prospect_id)
        if not prospects:
            print(f"❌ No prospect found with Primary = {args.prospect_id}")
            return
        process_prospect(prospects[0], tavily, claude, sb, dry_run=args.dry_run, company_profile=company_profile)
    elif args.count:
        # Batch mode from CLI
        count = None if args.count == "all" else int(args.count)
        prospects = fetch_prospects(sb, count=count)
        print(f"🎯 Processing {len(prospects)} prospects...")
        for i, p in enumerate(prospects, 1):
            print(f"\n[{i}/{len(prospects)}]", end="")
            process_prospect(p, tavily, claude, sb, dry_run=args.dry_run, company_profile=company_profile)
            if i < len(prospects):
                time.sleep(1)
    else:
        # Interactive mode
        interactive_mode(sb, tavily, claude, company_profile=company_profile)


if __name__ == "__main__":
    main()
