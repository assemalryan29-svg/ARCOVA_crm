-- Reconciled from ARCOVA production schema (migration already applied in Supabase).
-- Associates leads with campaigns for attribution/reporting.

alter table public.leads
  add column if not exists campaign_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_campaign_id_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_campaign_id_fkey
      foreign key (campaign_id) references public.campaigns(id);
  end if;
end $$;

create index if not exists idx_leads_campaign_id
  on public.leads(campaign_id);
