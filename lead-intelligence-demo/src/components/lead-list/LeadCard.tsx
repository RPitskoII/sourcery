import type { LeadWithActivity } from "../../types/leads";

interface LeadCardProps {
  lead: LeadWithActivity;
  selected: boolean;
  onClick: () => void;
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "gray";
  if (score >= 7) return "green";
  if (score >= 4) return "yellow";
  return "gray";
}

function urgencyClass(urgency: string | null | undefined): string {
  if (!urgency) return "urgency-future";
  if (urgency === "immediate") return "urgency-immediate";
  if (urgency === "near-term") return "urgency-near";
  return "urgency-future";
}

export function LeadCard({ lead, selected, onClick }: LeadCardProps) {
  const name = [lead["First Name"], lead["Last Name"]].filter(Boolean).join(" ") || "—";
  const company = lead["Company Name"] ?? "—";
  const title = lead["Title"] ?? "";
  const score = lead.overall_score ?? 0;
  const status = lead.activity?.status ?? "new";
  const nextActionDate = lead.activity?.next_action_date;
  const meetingDate = lead.activity?.meeting_date;

  return (
    <button
      type="button"
      className={`lead-card ${selected ? "lead-card-selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${company}, ${name}`}
    >
      <div className="lead-card-company">{company}</div>
      <div className="lead-card-contact">
        {name}
        {title ? ` · ${title}` : ""}
      </div>
      <div className="lead-card-meta">
        <span className={`score-badge score-${scoreColor(score)}`} title="Overall score">
          {score}/10
        </span>
        <span className={`urgency-badge ${urgencyClass(lead.urgency_level)}`}>
          {lead.urgency_level ?? "future"}
        </span>
        <span className="status-badge">{status.replace(/_/g, " ")}</span>
        {lead.breach_flag && (
          <span className="breach-indicator" title="Breach flag">⚠</span>
        )}
      </div>
      {(nextActionDate || (status === "meeting_scheduled" && meetingDate)) && (
        <div className="lead-card-date">
          {status === "meeting_scheduled" && meetingDate
            ? `Meeting ${new Date(meetingDate).toLocaleDateString()}`
            : nextActionDate
              ? `Next: ${new Date(nextActionDate).toLocaleDateString()}`
              : null}
        </div>
      )}
    </button>
  );
}
