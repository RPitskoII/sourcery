import type { LeadWithActivity } from "../../types/leads";

interface LeadCardProps {
  lead: LeadWithActivity;
  selected: boolean;
  onClick: () => void;
}

function getOrderValue(lead: LeadWithActivity): number | null {
  if (typeof lead.order === "number") return lead.order;
  if (typeof lead.order === "string" && lead.order.trim() !== "") {
    const parsed = Number(lead.order);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getOrderBadgeClass(order: number | null): string {
  if (order === 1) return "status-order-1";
  if (order === 2 || order === 3) return "status-order-2-3";
  if (order === 4) return "status-order-4";
  return "status-order-default";
}

export function LeadCard({ lead, selected, onClick }: LeadCardProps) {
  const name = [lead["First Name"], lead["Last Name"]].filter(Boolean).join(" ") || "—";
  const company = lead["Company Name"] ?? "—";
  const title = lead["Title"] ?? "";
  const status = lead.status ?? "N/A";
  const order = getOrderValue(lead);
  const statusClass = getOrderBadgeClass(order);
  const nextActionDate = lead.activity?.next_action_date;
  const meetingDate = lead.activity?.meeting_date;
  const contactTopLine = title ? `${name} · ${title}` : name;

  return (
    <button
      type="button"
      className={`lead-card ${selected ? "lead-card-selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${company}, ${name}`}
    >
      <div className="lead-card-company">
        <span className="lead-card-company-name">{company}</span>
        <span className="lead-card-company-contact">{contactTopLine}</span>
      </div>
      <div className="lead-card-status-row">
        <span className="lead-card-status-label">Status</span>
        <span className={`status-badge ${statusClass}`}>
          {status.replace(/_/g, " ")}
        </span>
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
