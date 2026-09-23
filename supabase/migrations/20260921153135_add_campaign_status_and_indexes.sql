-- RECOVERED MIGRATION FILE
-- Canonical production version/name restored from Supabase migration history.
-- SQL body recovered from the pre-existing repository migration 20260921_campaign_status.sql.
-- Do not edit historical recovery files after verification.

-- ARCOVA CRM: campaign lifecycle status
-- Applied to the connected Supabase project.

alter table public.campaigns
  add column if not exists status text not null default 'Active';

create index if not exists campaigns_created_at_idx
  on public.campaigns (created_at desc);

create index if not exists campaigns_status_idx
  on public.campaigns (status);
