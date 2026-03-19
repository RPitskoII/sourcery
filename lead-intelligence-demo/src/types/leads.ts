/** BulkProspects row (Supabase). PK is "Primary". */
export interface BulkProspect {
  Primary: number;
  "First Name"?: string | null;
  "Last Name"?: string | null;
  Title?: string | null;
  "Company Name"?: string | null;
  Email?: string | null;
  Industry?: string | null;
  Keywords?: string | null;
  Website?: string | null;
  "Company Linkedin Url"?: string | null;
  "Person Linkedin Url"?: string | null;
  "# Employees"?: number | null;
  City?: string | null;
  State?: string | null;
  Country?: string | null;
  "Total Funding"?: number | null;
  "Latest Funding"?: string | null;
  "Latest Funding Amount"?: string | null;
  "Last Raised At"?: string | null;
  "Annual Revenue"?: string | null;
  enrichment_status?: string | null;
  fit_score?: number | null;
  timing_score?: number | null;
  overall_score?: number | null;
  contact_role_fit?: number | null;
  icp_company_type?: string | null;
  icp_match_reasons?: string[] | null;
  sensitive_data_categories?: string[] | null;
  compliance_needs?: string[] | null;
  buy_signals?: BuySignal[] | null;
  trigger_events?: TriggerEvent[] | null;
  urgency_level?: string | null;
  current_privacy_posture?: string | null;
  privacy_gaps?: string[] | null;
  competitor_signals?: CompetitorSignal[] | null;
  breach_flag?: boolean | null;
  breach_details?: BreachDetails | null;
  risk_factors?: string[] | null;
  research_summary?: string | null;
  outreach_angle?: string | null;
  recommended_contact_approach?: string | null;
  fit_score_breakdown?: ScoreBreakdownItem[] | null;
  timing_score_breakdown?: ScoreBreakdownItem[] | null;
  email_draft_subject?: string | null;
  email_draft_body?: string | null;
  email_draft_service_line?: string | null;
  enriched_at?: string | null;
  status?: string | null;
  order?: number | string | null;

  // Demo-only hypothetical email thread fields on InPipe.
  // email2/email3/email4 represent an alternating back-and-forth sequence.
  email2?: string | null;
  email3?: string | null;
  email4?: string | null;
}

export interface BuySignal {
  type?: string;
  evidence?: string;
  source_url?: string;
}

export interface TriggerEvent {
  type?: string;
  date?: string;
  description?: string;
  source?: string;
}

export interface CompetitorSignal {
  [key: string]: unknown;
}

export interface BreachDetails {
  date?: string;
  scope?: string;
  data_types?: string;
  source?: string;
  regulatory_status?: string;
}

export interface ScoreBreakdownItem {
  criterion?: string;
  points?: number;
  evidence?: string;
}

export interface LeadActivity {
  id: number;
  lead_key: number;
  status: string;
  next_action: string | null;
  next_action_date: string | null;
  meeting_date: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type LeadStatus =
  | "new"
  | "contacted"
  | "replied"
  | "meeting_scheduled"
  | "in_progress"
  | "proposal_sent"
  | "closed_won"
  | "closed_lost";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "replied",
  "meeting_scheduled",
  "in_progress",
  "proposal_sent",
  "closed_won",
  "closed_lost",
];

/** Prospect + activity joined (activity may be undefined for "new") */
export interface LeadWithActivity extends BulkProspect {
  activity?: LeadActivity | null;
}

export type LeadSource = "inpipe" | "fresh";
