import { useMemo, useEffect } from "react";
import type { LeadWithActivity } from "../../types/leads";
import type { LeadSource } from "../../types/leads";
import { sortLeadsForDemo } from "../../utils/sortLeads";
import { ListFilters } from "./ListFilters";
import { LeadCard } from "./LeadCard";

interface LeadListPanelProps {
  leads: LeadWithActivity[];
  freshLeads: LeadWithActivity[];
  freshLeadStatusOverrides: Record<
    number,
    { statusText: string; sentSeq: number }
  >;
  selectedKey: number | null;
  selectedSource: LeadSource | null;
  onSelectLead: (key: number, source: LeadSource) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onFilteredCountChange?: (count: number) => void;
}

export function LeadListPanel({
  leads,
  freshLeads,
  freshLeadStatusOverrides,
  selectedKey,
  selectedSource,
  onSelectLead,
  search,
  onSearchChange,
  onFilteredCountChange,
}: LeadListPanelProps) {
  const filtered = useMemo(() => {
    function getOrderValue(lead: LeadWithActivity): number {
      const raw = lead.order;
      if (typeof raw === "number") return raw;
      if (typeof raw === "string" && raw.trim() !== "") {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
      }
      return Number.POSITIVE_INFINITY;
    }

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

    const prioritized = sortLeadsForDemo(list);
    return [...prioritized].sort((a, b) => getOrderValue(a) - getOrderValue(b));
  }, [leads, search]);

  useEffect(() => {
    onFilteredCountChange?.(filtered.length);
  }, [filtered.length, onFilteredCountChange]);

  const displayFreshLeads = useMemo(() => {
    const indexByPrimary = new Map<number, number>(
      freshLeads.map((l, i) => [l.Primary, i])
    );

    function getSentSeq(leadKey: number): number | null {
      const ov = freshLeadStatusOverrides[leadKey];
      return ov ? ov.sentSeq : null;
    }

    function isSent(leadKey: number): boolean {
      return freshLeadStatusOverrides[leadKey] != null;
    }

    // Demo behavior: once a FreshLead is "sent", move it to the bottom.
    // - unsent: preserve original FreshLeads ordering
    // - sent: order by when it was sent
    return [...freshLeads].sort((a, b) => {
      const aSent = isSent(a.Primary);
      const bSent = isSent(b.Primary);

      if (aSent !== bSent) return aSent ? 1 : -1;
      if (!aSent) {
        return (indexByPrimary.get(a.Primary) ?? 0) -
          (indexByPrimary.get(b.Primary) ?? 0);
      }

      return (getSentSeq(a.Primary) ?? 0) - (getSentSeq(b.Primary) ?? 0);
    });
  }, [freshLeads, freshLeadStatusOverrides]);

  return (
    <div className="lead-list-panel">
      <ListFilters
        search={search}
        onSearchChange={onSearchChange}
      />
      <div className="lead-list-scroll">
        {displayFreshLeads.length > 0 && (
          <div className="lead-list-section lead-list-section-new">
            <h3 className="lead-list-section-title">New leads</h3>
            {displayFreshLeads.map((lead) => (
              <LeadCard
                key={`fresh-${lead.Primary}`}
                lead={lead}
                selected={selectedSource === "fresh" && selectedKey === lead.Primary}
                onClick={() => onSelectLead(lead.Primary, "fresh")}
                statusOverrideText={
                  freshLeadStatusOverrides[lead.Primary]?.statusText ?? undefined
                }
                statusOverrideClass={
                  freshLeadStatusOverrides[lead.Primary] ? "status-order-2-3" : undefined
                }
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
