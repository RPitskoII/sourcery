# Alder & Birch — Lead Enrichment Pipeline

Automated prospect research and scoring for Alder & Birch Legal, PLLC.  
Pulls prospects from Supabase → researches with Tavily → synthesizes with Claude → writes enrichment back.

## Supabase schema for enrichment

The pipeline reads from the `BulkProspects` table and writes enrichment results back to the same row.

### Required / recommended input fields

These fields are used for pre-filtering and for the synthesis prompts:

- `Primary` (int): primary key for the row (used to write back enrichment)
- `Company Name` (text)
- `Website` (text)
- `First Name` / `Last Name` (text)
- `Title` (text)
- `Industry` (text)
- `Keywords` (text)
- `# Employees` (int)
- `Total Funding` (numeric)
- `Latest Funding` (text)
- `Latest Funding Amount` (numeric)
- `Last Raised At` (timestamptz or text)
- `Annual Revenue` (numeric or text)
- `City`, `State`, `Country` (text)

### Enrichment output columns

These columns are populated by `EnrichmentScript.py`:

| Column | Type | Description |
|--------|------|-------------|
| `enrichment_status` | text | `pending` / `enriched` / `skipped` / `error` |
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
| `risk_factors` | jsonb | Reasons they might not convert or reasons they were skipped |
| `research_summary` | text | 2-3 paragraph synthesis |
| `outreach_angle` | text | Recommended approach for partners |
| `recommended_contact_approach` | text | direct / loop_in_legal / loop_in_cto / etc. |
| `raw_research` | jsonb | Full Tavily results preserved |
| `email_draft_subject` | text | Optional subject line drafted by Claude |
| `email_draft_body` | text | Optional email body drafted by Claude |
| `email_draft_service_line` | text | Service line chosen for the draft |
| `enriched_at` | timestamptz | When enrichment was performed |

### Pre-filter logic (to save API cost)

Before spending API credits, the script filters on existing Supabase data:

- Employee count: 25–200
- Industry/keywords: SaaS, healthtech, fintech, e‑commerce, etc.
- Funding: must have raised at least one round (non-zero `Total Funding` or non-empty `Latest Funding`)

Prospects that fail pre-filter are marked `skipped` with reasons stored in `risk_factors`.

## Enrichment script (`EnrichmentScript.py`)

### Setup

```bash
pip install -r requirements.txt
```

Place your environment variables in `Enrichment/.env` (or export them in your shell):

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_KEY=your-key
export TAVILY_API_KEY=tvly-your-key
export ANTHROPIC_API_KEY=sk-ant-your-key
```

### Interactive mode (recommended)

```bash
python EnrichmentScript.py
```

You’ll see a menu that lets you:

- Process a small test batch (`1–9` prospects)
- Process `70` prospects in one run
- Process **all** pending prospects

### CLI batch modes

Process a specific number:

```bash
python EnrichmentScript.py --count 5
```

Process 70 prospects:

```bash
python EnrichmentScript.py --count 70
```

Process a single prospect by primary key:

```bash
python EnrichmentScript.py --prospect-id 42
```

Dry run (no writes to Supabase):

```bash
python EnrichmentScript.py --count 3 --dry-run
```

Full batch:

```bash
python EnrichmentScript.py --count all
```


