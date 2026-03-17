import type { LeadStatus } from "../../types/leads";

interface ListFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: LeadStatus | "all";
  onStatusFilterChange: (v: LeadStatus | "all") => void;
  minScore: number;
  onMinScoreChange: (v: number) => void;
  urgencyFilter: "all" | "immediate" | "immediate_near";
  onUrgencyFilterChange: (v: "all" | "immediate" | "immediate_near") => void;
}

const URGENCY_OPTIONS: { value: "all" | "immediate" | "immediate_near"; label: string }[] = [
  { value: "all", label: "All urgency" },
  { value: "immediate", label: "Immediate only" },
  { value: "immediate_near", label: "Immediate + near-term" },
];

export function ListFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  minScore,
  onMinScoreChange,
  urgencyFilter,
  onUrgencyFilterChange,
}: ListFiltersProps) {
  return (
    <div className="list-filters">
      <input
        type="text"
        className="filter-input"
        placeholder="Search company or contact..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search leads"
      />
      <select
        className="filter-select"
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as LeadStatus | "all")}
        aria-label="Filter by status"
      >
        <option value="all">All statuses</option>
        <option value="new">New</option>
        <option value="contacted">Contacted</option>
        <option value="replied">Replied</option>
        <option value="meeting_scheduled">Meeting scheduled</option>
        <option value="in_progress">In progress</option>
        <option value="proposal_sent">Proposal sent</option>
        <option value="closed_won">Closed won</option>
        <option value="closed_lost">Closed lost</option>
      </select>
      <label className="filter-label">
        Min score
        <select
          className="filter-select"
          value={minScore}
          onChange={(e) => onMinScoreChange(Number(e.target.value))}
          aria-label="Minimum overall score"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <select
        className="filter-select"
        value={urgencyFilter}
        onChange={(e) =>
          onUrgencyFilterChange(e.target.value as "all" | "immediate" | "immediate_near")
        }
        aria-label="Filter by urgency"
      >
        {URGENCY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
