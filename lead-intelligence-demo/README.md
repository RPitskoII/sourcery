# Lead Intelligence Demo — Alder & Birch

React SPA demo for viewing enriched prospect data and sales activity. Runs on localhost only.

## Setup

1. **Create `lead_activity` in Supabase**  
   Run the SQL in `supabase_lead_activity.sql` in your Supabase project’s SQL Editor (creates the `lead_activity` table and FK to your prospects table; edit the FK to reference `InPipe` if that’s your table).

2. **Allow anon key access (RLS)**  
   Run the SQL in `supabase_anon_policies.sql` in the SQL Editor. This adds Row Level Security policies so the anon (public) key can read `InPipe` and read/write `lead_activity`.

3. **Environment**  
   In this directory create a `.env` file with:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_KEY=your-anon-public-key
   ```

   **Use the anon (public) key only** — the app runs in the browser, and Supabase forbids the service_role (secret) key in client code. In Supabase Dashboard go to **Project Settings → API → Project API keys** and copy the **anon** `public` key. Do not use the `service_role` secret key here.

4. **Install and run**

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:5173 (or the port Vite prints).

## Data

- **InPipe**: Read-only. Prospect data is loaded from the `InPipe` table (same shape as BulkProspects). Only rows with `enrichment_status = 'enriched'` are shown.
- **lead_activity**: Created by the migration. The app reads and upserts status, next action, meeting date, and notes.

## Layout

- **Left (35%)**: Filters + scrollable lead list. Leads are ordered by sales priority (replied → meeting soon → contacted/in progress → new by score → rest).
- **Right (65%)**: Detail for the selected lead (scores, outreach angle, email draft, research, signals, compliance, notes). Status and notes are saved to `lead_activity`.

No backend server; the React app talks to Supabase from the browser.
