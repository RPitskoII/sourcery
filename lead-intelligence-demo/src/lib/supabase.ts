import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

if (!url || !key) {
  console.error(
    "[Supabase] Missing env: VITE_SUPABASE_URL =",
    url ? "set" : "MISSING",
    ", VITE_SUPABASE_KEY =",
    key ? "set" : "MISSING",
    ". Add them to lead-intelligence-demo/.env"
  );
} else if (key.toLowerCase().includes("secret") || key.startsWith("sb_secret")) {
  console.error(
    "[Supabase] You are using the SERVICE ROLE (secret) key in the browser. Supabase forbids this. Use the ANON (public) key instead: Supabase Dashboard → Project Settings → API → Project API keys → anon public."
  );
} else {
  console.log("[Supabase] Client init: URL =", url.replace(/\/$/, ""), "(anon key)");
}

export const supabase = createClient(url || "", key || "");
