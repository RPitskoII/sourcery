# Alder & Birch — Lead Enrichment Pipeline

Automated prospect research and scoring for Alder & Birch Legal, PLLC.  
Pulls prospects from Supabase → researches with Tavily → synthesizes with Claude → writes enrichment back.

## Setup

```bash
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your keys, then:

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_KEY=your-key
export TAVILY_API_KEY=tvly-your-key
export ANTHROPIC_API_KEY=sk-ant-your-key
```

### Add Enrichment Columns to Supabase

The script tries to add columns automatically. If that fails, generate the SQL:

```bash
python enrich.py --sql
```

Copy the output into Supabase SQL Editor and run it.

## Usage

### Interactive mode (recommended for first run)
```bash
python enrich.py
```

### Process a specific number
```bash
python enrich.py --count 5
```

### Process a single prospect
```bash
python enrich.py --prospect-id 42
```

### Dry run (no writes)
```bash
python enrich.py --count 3 --dry-run
```

### Full batch
```bash
python enrich.py --count all
```

## Enrichment Schema

| Column | Type | Description |
|--------|------|-------------|
| `enrichment_status` | text | pending / enriched / skipped / error |
| `fit_score` | integer | 1-10 ICP fit rating |
| `timing_score` | integer | 1-10 timing/urgency rating |
| `overall_score` | integer | 1-10 combined score (60% fit, 40% timing) |
| `contact_role_fit` | integer | 1-10 relevance of this contact |
| `icp_company_type` | text | saas / healthtech / fintech / ecommerce / other |
| `icp_match_reasons` | jsonb | Why they match the ICP |
| `sensitive_data_categories` | jsonb | Data types: health, financial, biometric, etc. |
| `compliance_needs` | jsonb | Regulations: GDPR, CCPA, HIPAA, SOC2, etc. |
| `buy_signals` | jsonb | Identified purchase indicators |
| `trigger_events` | jsonb | Recent events with dates and sources |
| `urgency_level` | text | immediate / near-term / future |
| `current_privacy_posture` | text | Assessment of existing privacy stance |
| `privacy_gaps` | jsonb | Identified compliance gaps |
| `competitor_signals` | jsonb | Signs of existing privacy counsel |
| `breach_flag` | boolean | Whether a breach was found |
| `breach_details` | jsonb | Breach date, scope, data types, status |
| `risk_factors` | jsonb | Reasons they might not convert |
| `research_summary` | text | 2-3 paragraph synthesis |
| `outreach_angle` | text | Recommended approach for partners |
| `recommended_contact_approach` | text | direct / loop_in_legal / loop_in_cto / etc. |
| `raw_research` | jsonb | Full Tavily results preserved |
| `enriched_at` | timestamptz | When enrichment was performed |

## Cost Estimates

Per prospect: ~4 Tavily searches + 1 Claude Sonnet call  
- Tavily: ~$0.01-0.04 per prospect (depending on plan)  
- Claude: ~$0.01-0.03 per prospect  
- **Total for 980 prospects: ~$20-60**

## Pre-filter Logic

Before spending API credits, the script filters on existing Supabase data:
- Employee count: 25-200
- Industry/keywords: SaaS, healthtech, fintech, e-commerce, etc.
- Funding: Must have raised at least one round

Prospects that fail pre-filter are marked `skipped` with reasons stored in `risk_factors`.
