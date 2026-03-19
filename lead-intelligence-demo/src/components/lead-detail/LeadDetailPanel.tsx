import { useEffect, useState } from "react";
import type { LeadWithActivity } from "../../types/leads";
import type { LeadSource } from "../../types/leads";
import { CompanyHeader } from "./CompanyHeader";
import { OutreachAngle } from "./OutreachAngle";
import { EmailDraft } from "./EmailDraft";
import { ResearchSummary } from "./ResearchSummary";
import { BuySignals } from "./BuySignals";
import { TriggerEvents } from "./TriggerEvents";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { ComplianceDetails } from "./ComplianceDetails";
import { NotesSection } from "./NotesSection";
import { EmailThread } from "./EmailThread";
import { CalendarMarch2026 } from "./CalendarMarch2026";

type ActivityPayload = {
  status?: string;
  next_action?: string | null;
  next_action_date?: string | null;
  meeting_date?: string | null;
};

function getOrderValue(order: number | string | null | undefined): number | null {
  if (typeof order === "number") return order;
  if (typeof order === "string" && order.trim() !== "") {
    const parsed = Number(order);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getOrderBadgeClass(order: number | null): string {
  if (order === 1) return "status-order-1";
  if (order === 2 || order === 3) return "status-order-2-3";
  if (order === 4) return "status-order-4";
  if (order === 7) return "status-order-7";
  return "status-order-default";
}

interface LeadDetailPanelProps {
  lead: LeadWithActivity | null;
  selectedSource: LeadSource | null;
  freshLeadStatusOverrides: Record<number, { statusText: string; sentSeq: number }>;
  onSetFreshLeadStatusOverride: (leadKey: number, statusText: string) => void;
  onSaveActivity: (leadKey: number, payload: ActivityPayload) => Promise<void>;
  onSaveNotes: (leadKey: number, notes: string) => Promise<void>;
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "gray";
  if (score >= 7) return "green";
  if (score >= 4) return "yellow";
  return "red";
}

export function LeadDetailPanel({
  lead,
  selectedSource,
  freshLeadStatusOverrides,
  onSetFreshLeadStatusOverride,
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

  const isInPipe = selectedSource === "inpipe";
  const isFresh = selectedSource === "fresh";
  const [inpipeTab, setInpipeTab] = useState<"contact" | "research" | "calendar">(
    "contact"
  );
  const [nextEmailDraft, setNextEmailDraft] = useState(
    "No recomendations at this time"
  );
  const order = getOrderValue(lead.order);
  const statusClass = getOrderBadgeClass(order);
  const freshStatusOverrideText = isFresh
    ? freshLeadStatusOverrides[lead.Primary]?.statusText ?? null
    : null;

  const freshStatusText = freshStatusOverrideText
    ? freshStatusOverrideText
    : lead.status
      ? String(lead.status)
      : "N/A";
  const freshStatusClass = freshStatusOverrideText
    ? "status-order-2-3"
    : statusClass;

  useEffect(() => {
    setInpipeTab("contact");
    setNextEmailDraft("No recomendations at this time");
  }, [lead.Primary, selectedSource]);

  return (
    <div className="lead-detail-panel">
      <div className="lead-detail-scroll">
        <CompanyHeader lead={lead} />

        {isInPipe ? (
          <>
            <div className="inpipe-status-bar">
              <span className="inpipe-status-label">Status</span>
              <span className={`status-badge ${statusClass}`}>
                {lead.status ? String(lead.status) : "N/A"}
              </span>
            </div>

            <div
              className="inpipe-menu"
              role="tablist"
              aria-label="Contact vs research"
            >
              <button
                type="button"
                className={`inpipe-menu-btn ${
                  inpipeTab === "contact" ? "inpipe-menu-btn-active" : ""
                }`}
                onClick={() => setInpipeTab("contact")}
                role="tab"
                aria-selected={inpipeTab === "contact"}
              >
                Contact
              </button>
              <button
                type="button"
                className={`inpipe-menu-btn ${
                  inpipeTab === "research" ? "inpipe-menu-btn-active" : ""
                }`}
                onClick={() => setInpipeTab("research")}
                role="tab"
                aria-selected={inpipeTab === "research"}
              >
                Research
              </button>
              <button
                type="button"
                className={`inpipe-menu-btn ${
                  inpipeTab === "calendar" ? "inpipe-menu-btn-active" : ""
                }`}
                onClick={() => setInpipeTab("calendar")}
                role="tab"
                aria-selected={inpipeTab === "calendar"}
              >
                Calendar
              </button>
            </div>

            {inpipeTab === "contact" ? (
              <>
                <section className="next-email-section">
                  <h3 className="next-email-title">New Email</h3>
                  <textarea
                    className="next-email-textarea"
                    value={nextEmailDraft}
                    onChange={(e) => setNextEmailDraft(e.target.value)}
                    rows={4}
                    aria-label="Write another email"
                  />
                </section>
                <EmailThread lead={lead} />
              </>
            ) : inpipeTab === "calendar" ? (
              <CalendarMarch2026 highlightPartifulDemoCall={order === 1} />
            ) : (
              <>
                <div className="research-score-row">
                  <span className={`score-badge score-${scoreColor(lead.fit_score)}`}>
                    Fit {lead.fit_score ?? "—"}/10
                  </span>
                  <span className={`score-badge score-${scoreColor(lead.timing_score)}`}>
                    Timing {lead.timing_score ?? "—"}/10
                  </span>
                  <span className={`score-badge score-${scoreColor(lead.overall_score)}`}>
                    Overall {lead.overall_score ?? "—"}/10
                  </span>
                </div>
                <ResearchSummary text={lead.research_summary ?? null} />
                <OutreachAngle text={lead.outreach_angle ?? null} />
                <BuySignals signals={lead.buy_signals ?? null} />
                <TriggerEvents events={lead.trigger_events ?? null} />
                <ScoreBreakdown
                  fitScore={lead.fit_score}
                  timingScore={lead.timing_score}
                  fitBreakdown={lead.fit_score_breakdown ?? null}
                  timingBreakdown={lead.timing_score_breakdown ?? null}
                />
                <ComplianceDetails lead={lead} />
              </>
            )}
          </>
        ) : (
          <>
            <div className="inpipe-status-bar">
              <span className="inpipe-status-label">Status</span>
              <span className={`status-badge ${freshStatusClass}`}>
                {freshStatusText}
              </span>
            </div>

            <div
              className="inpipe-menu"
              role="tablist"
              aria-label="Contact vs research"
            >
              <button
                type="button"
                className={`inpipe-menu-btn ${
                  inpipeTab === "contact" ? "inpipe-menu-btn-active" : ""
                }`}
                onClick={() => setInpipeTab("contact")}
                role="tab"
                aria-selected={inpipeTab === "contact"}
              >
                Contact
              </button>
              <button
                type="button"
                className={`inpipe-menu-btn ${
                  inpipeTab === "research" ? "inpipe-menu-btn-active" : ""
                }`}
                onClick={() => setInpipeTab("research")}
                role="tab"
                aria-selected={inpipeTab === "research"}
              >
                Research
              </button>
              <button
                type="button"
                className={`inpipe-menu-btn ${
                  inpipeTab === "calendar" ? "inpipe-menu-btn-active" : ""
                }`}
                onClick={() => setInpipeTab("calendar")}
                role="tab"
                aria-selected={inpipeTab === "calendar"}
              >
                Calendar
              </button>
            </div>

            {inpipeTab === "contact" ? (
              <EmailDraft
                subject={lead.email_draft_subject ?? null}
                body={lead.email_draft_body ?? null}
                serviceLine={lead.email_draft_service_line ?? null}
                hasDraft={hasEmailDraft}
                onSend={() =>
                  onSetFreshLeadStatusOverride(
                    lead.Primary,
                    "Waiting, Sent Thu 3/19"
                  )
                }
              />
            ) : inpipeTab === "calendar" ? (
              <CalendarMarch2026 highlightPartifulDemoCall={order === 1} />
            ) : (
              <>
                <div className="research-score-row">
                  <span className={`score-badge score-${scoreColor(lead.fit_score)}`}>
                    Fit {lead.fit_score ?? "—"}/10
                  </span>
                  <span className={`score-badge score-${scoreColor(lead.timing_score)}`}>
                    Timing {lead.timing_score ?? "—"}/10
                  </span>
                  <span className={`score-badge score-${scoreColor(lead.overall_score)}`}>
                    Overall {lead.overall_score ?? "—"}/10
                  </span>
                </div>
                <ResearchSummary text={lead.research_summary ?? null} />
                <OutreachAngle text={lead.outreach_angle ?? null} />
                <BuySignals signals={lead.buy_signals ?? null} />
                <TriggerEvents events={lead.trigger_events ?? null} />
                <ScoreBreakdown
                  fitScore={lead.fit_score}
                  timingScore={lead.timing_score}
                  fitBreakdown={lead.fit_score_breakdown ?? null}
                  timingBreakdown={lead.timing_score_breakdown ?? null}
                />
                <ComplianceDetails lead={lead} />
              </>
            )}
          </>
        )}

        <NotesSection
          notes={lead.activity?.notes ?? null}
          onSave={handleSaveNotes}
        />
      </div>
    </div>
  );
}
