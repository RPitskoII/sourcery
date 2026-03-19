import { LeadListPanel } from "./lead-list/LeadListPanel";
import { LeadDetailPanel } from "./lead-detail/LeadDetailPanel";
import type { LeadWithActivity } from "../types/leads";
import type { LeadSource } from "../types/leads";

interface MainLayoutProps {
  leads: LeadWithActivity[];
  freshLeads: LeadWithActivity[];
  selectedKey: number | null;
  selectedSource: LeadSource | null;
  onSelectLead: (key: number, source: LeadSource) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onSaveActivity: (leadKey: number, payload: Record<string, unknown>) => Promise<void>;
  onSaveNotes: (leadKey: number, notes: string) => Promise<void>;
  onFilteredCountChange?: (count: number) => void;
  loading: boolean;
  error: string | null;
}

export function MainLayout({
  leads,
  freshLeads,
  selectedKey,
  selectedSource,
  onSelectLead,
  search,
  onSearchChange,
  onSaveActivity,
  onSaveNotes,
  onFilteredCountChange,
  loading,
  error,
}: MainLayoutProps) {
  const selectedLead = selectedKey && selectedSource
    ? (selectedSource === "fresh"
        ? freshLeads.find((l) => l.Primary === selectedKey)
        : leads.find((l) => l.Primary === selectedKey)) ?? null
    : null;

  return (
    <div className="main-layout">
      <aside className="main-layout-left">
        {error && <div className="list-error" role="alert">{error}</div>}
        {loading ? (
          <div className="list-loading">Loading leads…</div>
        ) : (
          <LeadListPanel
            leads={leads}
            freshLeads={freshLeads}
            selectedKey={selectedKey}
            selectedSource={selectedSource}
            onSelectLead={onSelectLead}
            search={search}
            onSearchChange={onSearchChange}
            onFilteredCountChange={onFilteredCountChange}
          />
        )}
      </aside>
      <main className="main-layout-right">
        <LeadDetailPanel
          lead={selectedLead}
          selectedSource={selectedSource}
          onSaveActivity={onSaveActivity}
          onSaveNotes={onSaveNotes}
        />
      </main>
    </div>
  );
}
