import { useState, useCallback } from "react";
import { Header, type Screen } from "./components/Header";
import { Footer } from "./components/Footer";
import { MainLayout } from "./components/MainLayout";
import { GetLeadsModal } from "./components/GetLeadsModal";
import { useLeads } from "./hooks/useLeads";
import type { LeadStatus, LeadSource, LeadWithActivity } from "./types/leads";
import "./App.css";

export default function App() {
  const [getLeadsModalOpen, setGetLeadsModalOpen] = useState(false);
  const currentScreen: Screen = getLeadsModalOpen ? "get-leads" : "dashboard";
  const setCurrentScreen = (screen: Screen) => setGetLeadsModalOpen(screen === "get-leads");

  const {
    leadsWithActivity,
    loading,
    error,
    upsertActivity,
    fetchFreshLeads,
  } = useLeads();

  const [freshLeads, setFreshLeads] = useState<LeadWithActivity[]>([]);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [selectedSource, setSelectedSource] = useState<LeadSource | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [minScore, setMinScore] = useState(0);
  const [urgencyFilter, setUrgencyFilter] = useState<
    "all" | "immediate" | "immediate_near"
  >("all");
  const [filteredCount, setFilteredCount] = useState(0);

  const handleGetLeadsConfirm = useCallback(async () => {
    try {
      const leads = await fetchFreshLeads(5);
      setFreshLeads(leads);
      setGetLeadsModalOpen(false);
    } catch (e) {
      console.error("Get leads failed:", e);
      // Modal stays open; user can try again or close via header
    }
  }, [fetchFreshLeads]);

  const handleSelectLead = useCallback((key: number, source: LeadSource) => {
    setSelectedKey(key);
    setSelectedSource(source);
  }, []);

  const handleSaveActivity = useCallback(
    async (leadKey: number, payload: Record<string, unknown>) => {
      await upsertActivity(leadKey, payload);
    },
    [upsertActivity]
  );

  const handleSaveNotes = useCallback(
    async (leadKey: number, notes: string) => {
      await upsertActivity(leadKey, { notes });
    },
    [upsertActivity]
  );

  const lastEnrichedAt = leadsWithActivity.reduce<string | null>((acc, l) => {
    const t = l.enriched_at ?? null;
    if (!t) return acc;
    if (!acc) return t;
    return new Date(t) > new Date(acc) ? t : acc;
  }, null);

  return (
    <div className="app">
      <Header currentScreen={currentScreen} onNavigate={setCurrentScreen} />
      <MainLayout
        leads={leadsWithActivity}
        freshLeads={freshLeads}
        selectedKey={selectedKey}
        selectedSource={selectedSource}
        onSelectLead={handleSelectLead}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        minScore={minScore}
        onMinScoreChange={setMinScore}
        urgencyFilter={urgencyFilter}
        onUrgencyFilterChange={setUrgencyFilter}
        onSaveActivity={handleSaveActivity}
        onSaveNotes={handleSaveNotes}
        onFilteredCountChange={setFilteredCount}
        loading={loading}
        error={error}
      />
      <Footer
        leadCount={filteredCount}
        lastEnrichedAt={lastEnrichedAt}
      />
      {getLeadsModalOpen && (
        <GetLeadsModal onConfirm={handleGetLeadsConfirm} />
      )}
    </div>
  );
}
