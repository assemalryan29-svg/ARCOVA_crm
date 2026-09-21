-- ARCOVA CRM phase 2 lead ingestion hardening.
-- Applied to Supabase production on 2026-09-21.

alter view if exists public.lead_duplicate_groups set (security_invoker = true);

drop trigger if exists trg_prevent_lead_duplicates on public.leads;

alter table public.leads
  add column if not exists external_source text,
  add column if not exists external_lead_id text;

create unique index if not exists leads_external_identity_uidx
  on public.leads (external_source, external_lead_id)
  where external_source is not null and external_lead_id is not null;

create index if not exists leads_source_created_idx
  on public.leads (lead_source, created_at desc);
