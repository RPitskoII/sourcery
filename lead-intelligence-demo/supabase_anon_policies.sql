-- Run this in the Supabase SQL Editor to let the anon (public) key read/write
-- what the Lead Intelligence demo needs. Uses Row Level Security (RLS).
-- The app reads prospects from the InPipe table. If your table name is lowercase
-- (e.g. "inpipe"), change the quoted identifier below to match.
-- If a policy already exists (e.g. "anon_select_InPipe"), drop it first
-- or run the statements one by one and skip any that error.

-- 1) InPipe: anon can read all rows (demo only shows enriched).
alter table public."InPipe" enable row level security;

create policy "anon_select_InPipe"
  on public."InPipe"
  for select
  to anon
  using (true);

-- 2) FreshLeads: anon can read (used when user clicks "Get leads" in the app).
alter table public."FreshLeads" enable row level security;

create policy "anon_select_FreshLeads"
  on public."FreshLeads"
  for select
  to anon
  using (true);

-- 3) lead_activity: anon can read, insert, and update (so the app can save status/notes).
alter table public.lead_activity enable row level security;

create policy "anon_select_lead_activity"
  on public.lead_activity
  for select
  to anon
  using (true);

create policy "anon_insert_lead_activity"
  on public.lead_activity
  for insert
  to anon
  with check (true);

create policy "anon_update_lead_activity"
  on public.lead_activity
  for update
  to anon
  using (true)
  with check (true);
