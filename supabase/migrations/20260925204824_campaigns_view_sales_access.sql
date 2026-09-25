-- Reconciled from ARCOVA production schema (migration already applied in Supabase).
-- Campaign visibility and management are permission-gated.

alter table public.campaigns enable row level security;

drop policy if exists campaigns_select_scoped on public.campaigns;
create policy campaigns_select_scoped
on public.campaigns for select to authenticated
using ((select private.has_permission('campaigns.view')));

drop policy if exists campaigns_insert_scoped on public.campaigns;
create policy campaigns_insert_scoped
on public.campaigns for insert to authenticated
with check ((select private.has_permission('campaigns.manage')));

drop policy if exists campaigns_update_scoped on public.campaigns;
create policy campaigns_update_scoped
on public.campaigns for update to authenticated
using ((select private.has_permission('campaigns.manage')))
with check ((select private.has_permission('campaigns.manage')));

drop policy if exists campaigns_delete_scoped on public.campaigns;
create policy campaigns_delete_scoped
on public.campaigns for delete to authenticated
using ((select private.has_permission('campaigns.manage')));
