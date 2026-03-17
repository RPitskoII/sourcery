-- Run this in the Supabase SQL Editor to create the lead_activity table.
-- Ensure BulkProspects table exists and has primary key column "Primary" (or adjust the FK reference).

create table public.lead_activity (
  id bigint generated always as identity not null,
  lead_key bigint not null,
  status text not null default 'new'::text,
  next_action text null,
  next_action_date timestamp with time zone null,
  meeting_date timestamp with time zone null,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint lead_activity_pkey primary key (id),
  constraint lead_activity_lead_key_fkey foreign key (lead_key) references "BulkProspects" ("Primary"),
  constraint valid_status check (
    (
      status = any (
        array[
          'new'::text,
          'contacted'::text,
          'replied'::text,
          'meeting_scheduled'::text,
          'in_progress'::text,
          'proposal_sent'::text,
          'closed_won'::text,
          'closed_lost'::text
        ]
      )
    )
  )
) tablespace pg_default;

-- Optional: index for lookups by lead_key
create index if not exists lead_activity_lead_key_idx on public.lead_activity (lead_key);
