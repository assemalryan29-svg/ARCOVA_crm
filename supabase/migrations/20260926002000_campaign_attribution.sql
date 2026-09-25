-- ARCOVA CRM
-- Campaign attribution foundation: real Lead -> Campaign linkage.

alter table public.leads
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

create index if not exists idx_leads_campaign_id on public.leads(campaign_id);