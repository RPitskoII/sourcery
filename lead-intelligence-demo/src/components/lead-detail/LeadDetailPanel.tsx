import type { LeadWithActivity } from "../../types/leads";
import { CompanyHeader } from "./CompanyHeader";
import { StatusControls } from "./StatusControls";
import { OutreachAngle } from "./OutreachAngle";
import { EmailDraft } from "./EmailDraft";
import { ResearchSummary } from "./ResearchSummary";
import { BuySignals } from "./BuySignals";
import { TriggerEvents } from "./TriggerEvents";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { ComplianceDetails } from "./ComplianceDetails";
import { NotesSection } from "./NotesSection";

type ActivityPayload = {
  status?: string;
  next_action?: string | null;
  next_action_date?: string | null;
  meeting_date?: string | null;
};

interface LeadDetailPanelProps {
  lead: LeadWithActivity | null;
  onSaveActivity: (leadKey: number, payload: ActivityPayload) => Promise<void>;
  onSaveNotes: (leadKey: number, notes: string) => Promise<void>;
}

export function LeadDetailPanel({
  lead,
  onSaveActivity,
  onSaveNotes,
}: LeadDetailPanelProps) {
  if (!lead) {
    return (
      <div className="lead-detail-panel lead-detail-empty">
        <p>Select a lead to view details.</p>
      </div>
    );
  }

  const handleSaveActivity = async (payload: ActivityPayload) => {
    await onSaveActivity(lead.Primary, payload);
  };

  const handleSaveNotes = async (notes: string) => {
    await onSaveNotes(lead.Primary, notes);
  };

  const hasEmailDraft =
    (lead.email_draft_subject != null && lead.email_draft_subject.trim() !== "") ||
    (lead.email_draft_body != null && lead.email_draft_body.trim() !== "");

  return (
    <div className="lead-detail-panel">
      <div className="lead-detail-scroll">
        <CompanyHeader lead={lead} />
        <StatusControls
          activity={lead.activity ?? null}
          onSave={handleSaveActivity}
        />
        <OutreachAngle text={lead.outreach_angle ?? null} />
        <EmailDraft
          subject={lead.email_draft_subject ?? null}
          body={lead.email_draft_body ?? null}
          serviceLine={lead.email_draft_service_line ?? null}
          hasDraft={hasEmailDraft}
        />
        <ResearchSummary text={lead.research_summary ?? null} />
        <BuySignals signals={lead.buy_signals ?? null} />
        <TriggerEvents events={lead.trigger_events ?? null} />
        <ScoreBreakdown
          fitScore={lead.fit_score}
          timingScore={lead.timing_score}
          fitBreakdown={lead.fit_score_breakdown ?? null}
          timingBreakdown={lead.timing_score_breakdown ?? null}
        />
        <ComplianceDetails lead={lead} />
        <NotesSection
          notes={lead.activity?.notes ?? null}
          onSave={handleSaveNotes}
        />
      </div>
    </div>
  );
}
