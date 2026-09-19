-- ARCOVA CRM — Supabase RLS foundation
-- Run this in the ARCOVA Supabase SQL Editor after reviewing your existing policies.
-- This migration intentionally targets only columns confirmed in the current app:
-- user_roles.id, user_roles.role, leads.assigned_to, leads.lead_source.

create or replace function public.arcova_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(ur.role, 'sales'))
  from public.user_roles ur
  where ur.id = auth.uid()
  limit 1;
$$;

revoke all on function public.arcova_current_role() from public;
grant execute on function public.arcova_current_role() to authenticated;

alter table public.leads enable row level security;

drop policy if exists "arcova_leads_select" on public.leads;
create policy "arcova_leads_select"
on public.leads
for select
to authenticated
using (
  public.arcova_current_role() in ('admin', 'ceo', 'manager', 'finance')
  or assigned_to = auth.uid()
  or (
    public.arcova_current_role() = 'marketing'
    and (assigned_to = auth.uid() or lead_source = 'Marketing')
  )
);

drop policy if exists "arcova_leads_insert" on public.leads;
create policy "arcova_leads_insert"
on public.leads
for insert
to authenticated
with check (
  public.arcova_current_role() in ('admin', 'ceo', 'manager', 'team_leader', 'marketing')
  or assigned_to = auth.uid()
);

drop policy if exists "arcova_leads_update" on public.leads;
create policy "arcova_leads_update"
on public.leads
for update
to authenticated
using (
  public.arcova_current_role() in ('admin', 'ceo', 'manager')
  or assigned_to = auth.uid()
  or (
    public.arcova_current_role() = 'marketing'
    and (assigned_to = auth.uid() or lead_source = 'Marketing')
  )
)
with check (
  public.arcova_current_role() in ('admin', 'ceo', 'manager', 'team_leader', 'marketing')
  or assigned_to = auth.uid()
);

drop policy if exists "arcova_leads_delete" on public.leads;
create policy "arcova_leads_delete"
on public.leads
for delete
to authenticated
using (
  public.arcova_current_role() in ('admin', 'ceo', 'manager')
);

-- NOTE:
-- user_roles RLS and team-leader team scoping are intentionally left for the next
-- database step because the current create-user flow still uses auth.signUp()
-- directly from the browser, and the teams table schema has not been verified yet.
