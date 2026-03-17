import { useMemo, useEffect } from "react";
import type { LeadWithActivity } from "../../types/leads";
import type { LeadStatus, LeadSource } from "../../types/leads";
import { sortLeadsForDemo } from "../../utils/sortLeads";
import { ListFilters } from "./ListFilters";
import { LeadCard } from "./LeadCard";

interface LeadListPanelProps {
  leads: LeadWithActivity[];
  freshLeads: LeadWithActivity[];
  selectedKey: number | null;
  selectedSource: LeadSource | null;
  onSelectLead: (key: number, source: LeadSource) => void;
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: LeadStatus | "all";
  onStatusFilterChange: (v: LeadStatus | "all") => void;
  minScore: number;
  onMinScoreChange: (v: number) => void;
  urgencyFilter: "all" | "immediate" | "immediate_near";
  onUrgencyFilterChange: (v: "all" | "immediate" | "immediate_near") => void;
  onFilteredCountChange?: (count: number) => void;
}

export function LeadListPanel({
  leads,
  freshLeads,
  selectedKey,
  selectedSource,
  onSelectLead,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  minScore,
  onMinScoreChange,
  urgencyFilter,
  onUrgencyFilterChange,
  onFilteredCountChange,
}: LeadListPanelProps) {
  const filtered = useMemo(() => {
    let list = leads;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (l) =>
          (l["Company Name"] ?? "").toLowerCase().includes(q) ||
          (l["First Name"] ?? "").toLowerCase().includes(q) ||
          (l["Last Name"] ?? "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((l) => (l.activity?.status ?? "new") === statusFilter);
    }

    list = list.filter((l) => (l.overall_score ?? 0) >= minScore);

    if (urgencyFilter === "immediate") {
      list = list.filter((l) => l.urgency_level === "immediate");
    } else if (urgencyFilter === "immediate_near") {
      list = list.filter(
        (l) => l.urgency_level === "immediate" || l.urgency_level === "near-term"
      );
    }

    return sortLeadsForDemo(list);
  }, [
    leads,
    search,
    statusFilter,
    minScore,
    urgencyFilter,
  ]);

  useEffect(() => {
    onFilteredCountChange?.(filtered.length);
  }, [filtered.length, onFilteredCountChange]);

  return (
    <div className="lead-list-panel">
      <ListFilters
        search={search}
        onSearchChange={onSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        minScore={minScore}
        onMinScoreChange={onMinScoreChange}
        urgencyFilter={urgencyFilter}
        onUrgencyFilterChange={onUrgencyFilterChange}
      />
      <div className="lead-list-scroll">
        {freshLeads.length > 0 && (
          <div className="lead-list-section lead-list-section-new">
            <h3 className="lead-list-section-title">New leads</h3>
            {freshLeads.map((lead) => (
              <LeadCard
                key={`fresh-${lead.Primary}`}
                lead={lead}
                selected={selectedSource === "fresh" && selectedKey === lead.Primary}
                onClick={() => onSelectLead(lead.Primary, "fresh")}
              />
            ))}
          </div>
        )}
        <div className="lead-list-section">
          {freshLeads.length > 0 && (
            <h3 className="lead-list-section-title">InPipe leads</h3>
          )}
          {filtered.map((lead) => (
            <LeadCard
              key={`inpipe-${lead.Primary}`}
              lead={lead}
              selected={selectedSource === "inpipe" && selectedKey === lead.Primary}
              onClick={() => onSelectLead(lead.Primary, "inpipe")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
