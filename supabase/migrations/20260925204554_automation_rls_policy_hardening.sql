-- Reconciled from ARCOVA production schema (migration already applied in Supabase).
-- Automation configuration is restricted to users with explicit automation permissions.

alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;

drop policy if exists automation_rules_select_scoped on public.automation_rules;
create policy automation_rules_select_scoped
on public.automation_rules for select to authenticated
using ((select private.has_permission('automation.view')));

drop policy if exists automation_rules_manage_insert on public.automation_rules;
create policy automation_rules_manage_insert
on public.automation_rules for insert to authenticated
with check ((select private.has_permission('automation.manage')));

drop policy if exists automation_rules_manage_update on public.automation_rules;
create policy automation_rules_manage_update
on public.automation_rules for update to authenticated
using ((select private.has_permission('automation.manage')))
with check ((select private.has_permission('automation.manage')));

drop policy if exists automation_rules_manage_delete on public.automation_rules;
create policy automation_rules_manage_delete
on public.automation_rules for delete to authenticated
using ((select private.has_permission('automation.manage')));

drop policy if exists automation_runs_select_scoped on public.automation_runs;
create policy automation_runs_select_scoped
on public.automation_runs for select to authenticated
using ((select private.has_permission('automation.view')));
