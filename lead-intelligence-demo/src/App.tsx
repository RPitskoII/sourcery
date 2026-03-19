import { useState, useCallback, useRef } from "react";
import { Header, type Screen } from "./components/Header";
import { Footer } from "./components/Footer";
import { MainLayout } from "./components/MainLayout";
import { GetLeadsModal } from "./components/GetLeadsModal";
import { useLeads } from "./hooks/useLeads";
import type { LeadSource, LeadWithActivity } from "./types/leads";
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
  type FreshLeadStatusOverride = { statusText: string; sentSeq: number };
  const [freshLeadStatusOverrides, setFreshLeadStatusOverrides] = useState<
    Record<number, FreshLeadStatusOverride>
  >({});
  const freshLeadSentSeqRef = useRef(0);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [selectedSource, setSelectedSource] = useState<LeadSource | null>(null);
  const [search, setSearch] = useState("");
  const [filteredCount, setFilteredCount] = useState(0);

  const handleGetLeadsConfirm = useCallback(async () => {
    try {
      const leads = await fetchFreshLeads(5);
      setFreshLeads(leads);
      // Reset demo-only overrides when loading a new set of FreshLeads.
      setFreshLeadStatusOverrides({});
      freshLeadSentSeqRef.current = 0;
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

  const handleSetFreshLeadStatusOverride = useCallback(
    (leadKey: number, statusText: string) => {
      // Demo-only local change: do not persist to Supabase.
      setFreshLeadStatusOverrides((prev) => {
        if (prev[leadKey] != null) return prev;
        console.debug("[FreshLeads] status override set", {
          leadKey,
          statusText,
        });
        return {
          ...prev,
          [leadKey]: {
            statusText,
            sentSeq: ++freshLeadSentSeqRef.current,
          },
        };
      });
    },
    []
  );

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
        freshLeadStatusOverrides={freshLeadStatusOverrides}
        selectedKey={selectedKey}
        selectedSource={selectedSource}
        onSelectLead={handleSelectLead}
        search={search}
        onSearchChange={setSearch}
        onSaveActivity={handleSaveActivity}
        onSaveNotes={handleSaveNotes}
        onSetFreshLeadStatusOverride={handleSetFreshLeadStatusOverride}
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
