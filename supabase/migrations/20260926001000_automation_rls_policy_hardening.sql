-- ARCOVA CRM
-- Automation RLS policy hardening: keep SELECT on the view policy and
-- separate management actions to avoid multiple permissive SELECT policies.

drop policy if exists automation_rules_manage_scoped on public.automation_rules;

create policy automation_rules_manage_insert
on public.automation_rules for insert to authenticated
with check ((select private.has_permission('automation.manage')));

create policy automation_rules_manage_update
on public.automation_rules for update to authenticated
using ((select private.has_permission('automation.manage')))
with check ((select private.has_permission('automation.manage')));

create policy automation_rules_manage_delete
on public.automation_rules for delete to authenticated
using ((select private.has_permission('automation.manage')));