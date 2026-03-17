import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type {
  BulkProspect,
  LeadActivity,
  LeadWithActivity,
} from "../types/leads";

const PROSPECTS_TABLE = "InPipe";
const FRESH_LEADS_TABLE = "FreshLeads";
const LEAD_ACTIVITY_TABLE = "lead_activity";

export function useLeads() {
  const [prospects, setProspects] = useState<BulkProspect[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    console.log("[useLeads] Fetching: table =", PROSPECTS_TABLE, "filter enrichment_status=enriched, and table =", LEAD_ACTIVITY_TABLE);
    try {
      const [prospectsRes, activitiesRes] = await Promise.all([
        supabase
          .from(PROSPECTS_TABLE)
          .select("*")
          .eq("enrichment_status", "enriched")
          .order("overall_score", { ascending: false }),
        supabase.from(LEAD_ACTIVITY_TABLE).select("*"),
      ]);

      if (prospectsRes.error) {
        console.error("[useLeads] InPipe error:", prospectsRes.error.message, "code:", (prospectsRes.error as { code?: string }).code, "details:", prospectsRes.error);
        throw prospectsRes.error;
      }
      if (activitiesRes.error) {
        console.error("[useLeads] lead_activity error:", activitiesRes.error.message, "code:", (activitiesRes.error as { code?: string }).code, "details:", activitiesRes.error);
        throw activitiesRes.error;
      }

      const prospectList = (prospectsRes.data as BulkProspect[]) || [];
      const activityList = (activitiesRes.data as LeadActivity[]) || [];
      console.log("[useLeads] Loaded", prospectList.length, "prospects,", activityList.length, "activity rows");
      setProspects(prospectList);
      setActivities(activityList);
    } catch (e) {
      const err = e as Error & { code?: string; details?: string };
      const message = err.message || "Failed to load leads";
      const detail = err.code ? ` (${err.code})` : "";
      console.error("[useLeads] Failed:", message, detail, err);
      setError(message + detail);
      setProspects([]);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const getActivityByLeadKey = useCallback(
    (leadKey: number): LeadActivity | undefined =>
      activities.find((a) => a.lead_key === leadKey),
    [activities]
  );

  const leadsWithActivity: LeadWithActivity[] = prospects.map((p) => ({
    ...p,
    activity: getActivityByLeadKey(p.Primary) ?? null,
  }));

  const upsertActivity = useCallback(
    async (leadKey: number, payload: Partial<LeadActivity>) => {
      const existing = activities.find((a) => a.lead_key === leadKey);
      const row = {
        ...payload,
        lead_key: leadKey,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { data, error: err } = await supabase
          .from(LEAD_ACTIVITY_TABLE)
          .update(row)
          .eq("id", existing.id)
          .select()
          .single();
        if (err) throw err;
        setActivities((prev) =>
          prev.map((a) => (a.lead_key === leadKey ? (data as LeadActivity) : a))
        );
        return data as LeadActivity;
      } else {
        const { data, error: err } = await supabase
          .from(LEAD_ACTIVITY_TABLE)
          .insert(row)
          .select()
          .single();
        if (err) throw err;
        setActivities((prev) => [...prev, data as LeadActivity]);
        return data as LeadActivity;
      }
    },
    [activities]
  );

  const fetchFreshLeads = useCallback(async (limit: number): Promise<LeadWithActivity[]> => {
    const { data, error: err } = await supabase
      .from(FRESH_LEADS_TABLE)
      .select("*")
      .limit(limit);
    if (err) {
      console.error("[useLeads] FreshLeads error:", err.message, err);
      throw err;
    }
    const rows = (data as BulkProspect[]) || [];
    return rows.map((p) => ({ ...p, activity: null }));
  }, []);

  return {
    prospects,
    activities,
    leadsWithActivity,
    loading,
    error,
    refetch: fetch,
    upsertActivity,
    fetchFreshLeads,
  };
}
