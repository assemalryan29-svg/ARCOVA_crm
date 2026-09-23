-- RECOVERED MIGRATION FILE
-- Canonical current RLS policy set reconstructed from pg_policies in production.
-- Policies are dropped/recreated idempotently to converge a rebuilt database to the live model.

do $$
declare r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname='public'
  loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end $$;


drop policy if exists activity_insert on public.activity_logs;
create policy activity_insert on public.activity_logs for INSERT to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));

drop policy if exists activity_logs_select_scoped on public.activity_logs;
create policy activity_logs_select_scoped on public.activity_logs for SELECT to authenticated
using ((( SELECT private.has_permission('dashboard.view'::text) AS has_permission) AND ((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.has_permission('audit.view'::text) AS has_permission))));

drop policy if exists app_permissions_delete_manage on public.app_permissions;
create policy app_permissions_delete_manage on public.app_permissions for DELETE to authenticated
using (( SELECT private.has_permission('roles.manage'::text) AS has_permission));

drop policy if exists app_permissions_insert_manage on public.app_permissions;
create policy app_permissions_insert_manage on public.app_permissions for INSERT to authenticated
with check (( SELECT private.has_permission('roles.manage'::text) AS has_permission));

drop policy if exists app_permissions_select_authenticated on public.app_permissions;
create policy app_permissions_select_authenticated on public.app_permissions for SELECT to authenticated
using ((( SELECT auth.uid() AS uid) IS NOT NULL));

drop policy if exists app_permissions_update_manage on public.app_permissions;
create policy app_permissions_update_manage on public.app_permissions for UPDATE to authenticated
using (( SELECT private.has_permission('roles.manage'::text) AS has_permission))
with check (( SELECT private.has_permission('roles.manage'::text) AS has_permission));

drop policy if exists app_role_permissions_delete_manage on public.app_role_permissions;
create policy app_role_permissions_delete_manage on public.app_role_permissions for DELETE to authenticated
using (( SELECT private.has_permission('roles.manage'::text) AS has_permission));

drop policy if exists app_role_permissions_insert_manage on public.app_role_permissions;
create policy app_role_permissions_insert_manage on public.app_role_permissions for INSERT to authenticated
with check (( SELECT private.has_permission('roles.manage'::text) AS has_permission));

drop policy if exists app_role_permissions_select_own on public.app_role_permissions;
create policy app_role_permissions_select_own on public.app_role_permissions for SELECT to authenticated
using (((role_key = ( SELECT private."current_role"() AS "current_role")) OR ( SELECT private.has_permission('roles.manage'::text) AS has_permission)));

drop policy if exists app_role_permissions_update_manage on public.app_role_permissions;
create policy app_role_permissions_update_manage on public.app_role_permissions for UPDATE to authenticated
using (( SELECT private.has_permission('roles.manage'::text) AS has_permission))
with check (( SELECT private.has_permission('roles.manage'::text) AS has_permission));

drop policy if exists app_roles_delete_manage on public.app_roles;
create policy app_roles_delete_manage on public.app_roles for DELETE to authenticated
using (( SELECT private.has_permission('roles.manage'::text) AS has_permission));

drop policy if exists app_roles_insert_manage on public.app_roles;
create policy app_roles_insert_manage on public.app_roles for INSERT to authenticated
with check (( SELECT private.has_permission('roles.manage'::text) AS has_permission));

drop policy if exists app_roles_select_authenticated on public.app_roles;
create policy app_roles_select_authenticated on public.app_roles for SELECT to authenticated
using ((( SELECT auth.uid() AS uid) IS NOT NULL));

drop policy if exists app_roles_update_manage on public.app_roles;
create policy app_roles_update_manage on public.app_roles for UPDATE to authenticated
using (( SELECT private.has_permission('roles.manage'::text) AS has_permission))
with check (( SELECT private.has_permission('roles.manage'::text) AS has_permission));

drop policy if exists appointments_delete_scoped on public.appointments;
create policy appointments_delete_scoped on public.appointments for DELETE to authenticated
using ((( SELECT private.has_permission('appointments.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(appointments.assigned_to) AS can_access_user)));

drop policy if exists appointments_insert_scoped on public.appointments;
create policy appointments_insert_scoped on public.appointments for INSERT to authenticated
with check ((( SELECT private.has_permission('appointments.manage'::text) AS has_permission) AND ((assigned_to = ( SELECT auth.uid() AS uid)) OR (( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text, 'team_leader'::text])))));

drop policy if exists appointments_select_scoped on public.appointments;
create policy appointments_select_scoped on public.appointments for SELECT to authenticated
using ((( SELECT private.has_permission('appointments.view'::text) AS has_permission) AND ( SELECT private.can_access_user(appointments.assigned_to) AS can_access_user)));

drop policy if exists appointments_update_scoped on public.appointments;
create policy appointments_update_scoped on public.appointments for UPDATE to authenticated
using ((( SELECT private.has_permission('appointments.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(appointments.assigned_to) AS can_access_user)))
with check ((( SELECT private.has_permission('appointments.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(appointments.assigned_to) AS can_access_user)));

drop policy if exists audit_logs_insert_own on public.audit_logs;
create policy audit_logs_insert_own on public.audit_logs for INSERT to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));

drop policy if exists audit_logs_select_scoped on public.audit_logs;
create policy audit_logs_select_scoped on public.audit_logs for SELECT to authenticated
using (( SELECT private.has_permission('audit.view'::text) AS has_permission));

drop policy if exists calls_delete_scoped on public.calls;
create policy calls_delete_scoped on public.calls for DELETE to authenticated
using ((( SELECT private.has_permission('calls.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(calls.assigned_to) AS can_access_user)));

drop policy if exists calls_insert_scoped on public.calls;
create policy calls_insert_scoped on public.calls for INSERT to authenticated
with check ((( SELECT private.has_permission('calls.manage'::text) AS has_permission) AND ((assigned_to = ( SELECT auth.uid() AS uid)) OR (( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text, 'team_leader'::text])))));

drop policy if exists calls_select_scoped on public.calls;
create policy calls_select_scoped on public.calls for SELECT to authenticated
using ((( SELECT private.has_permission('calls.view'::text) AS has_permission) AND ( SELECT private.can_access_lead(calls.lead_id) AS can_access_lead)));

drop policy if exists calls_update_scoped on public.calls;
create policy calls_update_scoped on public.calls for UPDATE to authenticated
using ((( SELECT private.has_permission('calls.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(calls.assigned_to) AS can_access_user)))
with check ((( SELECT private.has_permission('calls.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(calls.assigned_to) AS can_access_user)));

drop policy if exists campaigns_delete_scoped on public.campaigns;
create policy campaigns_delete_scoped on public.campaigns for DELETE to authenticated
using (( SELECT private.has_permission('campaigns.manage'::text) AS has_permission));

drop policy if exists campaigns_insert_scoped on public.campaigns;
create policy campaigns_insert_scoped on public.campaigns for INSERT to authenticated
with check (( SELECT private.has_permission('campaigns.manage'::text) AS has_permission));

drop policy if exists campaigns_select_scoped on public.campaigns;
create policy campaigns_select_scoped on public.campaigns for SELECT to authenticated
using (( SELECT private.has_permission('campaigns.view'::text) AS has_permission));

drop policy if exists campaigns_update_scoped on public.campaigns;
create policy campaigns_update_scoped on public.campaigns for UPDATE to authenticated
using (( SELECT private.has_permission('campaigns.manage'::text) AS has_permission))
with check (( SELECT private.has_permission('campaigns.manage'::text) AS has_permission));

drop policy if exists deal_payments_delete_scoped on public.deal_payments;
create policy deal_payments_delete_scoped on public.deal_payments for DELETE to authenticated
using (( SELECT private.has_permission('finance.manage'::text) AS has_permission));

drop policy if exists deal_payments_insert_scoped on public.deal_payments;
create policy deal_payments_insert_scoped on public.deal_payments for INSERT to authenticated
with check (( SELECT private.has_permission('finance.manage'::text) AS has_permission));

drop policy if exists deal_payments_select_scoped_v2 on public.deal_payments;
create policy deal_payments_select_scoped_v2 on public.deal_payments for SELECT to authenticated
using ((( SELECT private.has_permission('finance.view'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM deals d
  WHERE ((d.id = deal_payments.deal_id) AND (( SELECT private.can_access_user(d.sales_person) AS can_access_user) OR ( SELECT private.has_permission('finance.view'::text) AS has_permission)))))));

drop policy if exists deal_payments_update_scoped on public.deal_payments;
create policy deal_payments_update_scoped on public.deal_payments for UPDATE to authenticated
using (( SELECT private.has_permission('finance.manage'::text) AS has_permission))
with check (( SELECT private.has_permission('finance.manage'::text) AS has_permission));

drop policy if exists deals_delete_scoped on public.deals;
create policy deals_delete_scoped on public.deals for DELETE to authenticated
using ((( SELECT private.has_permission('deals.manage'::text) AS has_permission) AND ((( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text])) OR ( SELECT private.can_access_user(deals.sales_person) AS can_access_user))));

drop policy if exists deals_insert_scoped on public.deals;
create policy deals_insert_scoped on public.deals for INSERT to authenticated
with check ((( SELECT private.has_permission('deals.manage'::text) AS has_permission) AND ((sales_person = ( SELECT auth.uid() AS uid)) OR (( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text, 'team_leader'::text])))));

drop policy if exists deals_select_scoped on public.deals;
create policy deals_select_scoped on public.deals for SELECT to authenticated
using ((( SELECT private.has_permission('deals.view'::text) AS has_permission) AND (( SELECT private.can_access_user(deals.sales_person) AS can_access_user) OR ( SELECT private.has_permission('finance.view'::text) AS has_permission))));

drop policy if exists deals_update_scoped on public.deals;
create policy deals_update_scoped on public.deals for UPDATE to authenticated
using ((( SELECT private.has_permission('deals.manage'::text) AS has_permission) AND (( SELECT private.can_access_user(deals.sales_person) AS can_access_user) OR (( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text])))))
with check ((( SELECT private.has_permission('deals.manage'::text) AS has_permission) AND (( SELECT private.can_access_user(deals.sales_person) AS can_access_user) OR (( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text])))));

drop policy if exists developers_delete_scoped on public.developers;
create policy developers_delete_scoped on public.developers for DELETE to authenticated
using (( SELECT private.has_permission('projects.manage'::text) AS has_permission));

drop policy if exists developers_insert_scoped on public.developers;
create policy developers_insert_scoped on public.developers for INSERT to authenticated
with check (( SELECT private.has_permission('projects.manage'::text) AS has_permission));

drop policy if exists developers_select_scoped on public.developers;
create policy developers_select_scoped on public.developers for SELECT to authenticated
using (( SELECT private.has_permission('projects.view'::text) AS has_permission));

drop policy if exists developers_update_scoped on public.developers;
create policy developers_update_scoped on public.developers for UPDATE to authenticated
using (( SELECT private.has_permission('projects.manage'::text) AS has_permission))
with check (( SELECT private.has_permission('projects.manage'::text) AS has_permission));

drop policy if exists followups_delete_scoped_v2 on public.followups;
create policy followups_delete_scoped_v2 on public.followups for DELETE to authenticated
using ((( SELECT private.has_permission('followups.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(followups.assigned_to) AS can_access_user)));

drop policy if exists followups_insert_scoped_v2 on public.followups;
create policy followups_insert_scoped_v2 on public.followups for INSERT to authenticated
with check ((( SELECT private.has_permission('followups.manage'::text) AS has_permission) AND ((assigned_to = ( SELECT auth.uid() AS uid)) OR (( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text, 'team_leader'::text])))));

drop policy if exists followups_select_scoped on public.followups;
create policy followups_select_scoped on public.followups for SELECT to authenticated
using ((( SELECT private.has_permission('followups.view'::text) AS has_permission) AND ( SELECT private.can_access_user(followups.assigned_to) AS can_access_user)));

drop policy if exists followups_update_scoped_v2 on public.followups;
create policy followups_update_scoped_v2 on public.followups for UPDATE to authenticated
using ((( SELECT private.has_permission('followups.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(followups.assigned_to) AS can_access_user)))
with check ((( SELECT private.has_permission('followups.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(followups.assigned_to) AS can_access_user)));

drop policy if exists inventory_delete_scoped on public.inventory;
create policy inventory_delete_scoped on public.inventory for DELETE to authenticated
using (( SELECT private.has_permission('units.manage'::text) AS has_permission));

drop policy if exists inventory_insert_scoped on public.inventory;
create policy inventory_insert_scoped on public.inventory for INSERT to authenticated
with check (( SELECT private.has_permission('units.manage'::text) AS has_permission));

drop policy if exists inventory_select_scoped on public.inventory;
create policy inventory_select_scoped on public.inventory for SELECT to authenticated
using (( SELECT private.has_permission('units.view'::text) AS has_permission));

drop policy if exists inventory_update_scoped on public.inventory;
create policy inventory_update_scoped on public.inventory for UPDATE to authenticated
using (( SELECT private.has_permission('units.manage'::text) AS has_permission))
with check (( SELECT private.has_permission('units.manage'::text) AS has_permission));

drop policy if exists lead_activities_insert_scoped on public.lead_activities;
create policy lead_activities_insert_scoped on public.lead_activities for INSERT to authenticated
with check ((( SELECT private.has_permission('followups.manage'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_activities.lead_id) AND ( SELECT private.can_access_lead(l.assigned_to) AS can_access_lead))))));

drop policy if exists lead_activities_select_scoped_v2 on public.lead_activities;
create policy lead_activities_select_scoped_v2 on public.lead_activities for SELECT to authenticated
using ((( SELECT private.has_permission('followups.view'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_activities.lead_id) AND ( SELECT private.can_access_lead(l.assigned_to) AS can_access_lead))))));

drop policy if exists lead_folders_delete_manage on public.lead_folders;
create policy lead_folders_delete_manage on public.lead_folders for DELETE to authenticated
using (( SELECT private.has_permission('leads.update'::text) AS has_permission));

drop policy if exists lead_folders_insert_manage on public.lead_folders;
create policy lead_folders_insert_manage on public.lead_folders for INSERT to authenticated
with check (( SELECT private.has_permission('leads.create'::text) AS has_permission));

drop policy if exists lead_folders_select_scoped on public.lead_folders;
create policy lead_folders_select_scoped on public.lead_folders for SELECT to authenticated
using (( SELECT private.has_permission('leads.view'::text) AS has_permission));

drop policy if exists lead_folders_update_manage on public.lead_folders;
create policy lead_folders_update_manage on public.lead_folders for UPDATE to authenticated
using (( SELECT private.has_permission('leads.update'::text) AS has_permission))
with check (( SELECT private.has_permission('leads.update'::text) AS has_permission));

drop policy if exists lead_logs_insert_scoped on public.lead_logs;
create policy lead_logs_insert_scoped on public.lead_logs for INSERT to authenticated
with check ((( SELECT private.has_permission('leads.update'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_logs.lead_id) AND ( SELECT private.can_access_lead(l.assigned_to) AS can_access_lead))))));

drop policy if exists lead_logs_select_scoped_v2 on public.lead_logs;
create policy lead_logs_select_scoped_v2 on public.lead_logs for SELECT to authenticated
using ((( SELECT private.has_permission('leads.view'::text) AS has_permission) AND (EXISTS ( SELECT 1
   FROM leads l
  WHERE ((l.id = lead_logs.lead_id) AND ( SELECT private.can_access_lead(l.assigned_to) AS can_access_lead))))));

drop policy if exists leads_delete_scoped on public.leads;
create policy leads_delete_scoped on public.leads for DELETE to authenticated
using ((( SELECT private.has_permission('leads.delete'::text) AS has_permission) AND (( SELECT private."current_role"() AS "current_role") = 'admin'::text)));

drop policy if exists leads_insert_scoped on public.leads;
create policy leads_insert_scoped on public.leads for INSERT to authenticated
with check ((( SELECT private.has_permission('leads.create'::text) AS has_permission) AND ((( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text, 'team_leader'::text, 'marketing'::text])) OR (assigned_to = ( SELECT auth.uid() AS uid)))));

drop policy if exists leads_select_scoped on public.leads;
create policy leads_select_scoped on public.leads for SELECT to authenticated
using ((( SELECT private.has_permission('leads.view'::text) AS has_permission) AND ( SELECT private.can_access_lead(leads.assigned_to) AS can_access_lead)));

drop policy if exists leads_update_scoped on public.leads;
create policy leads_update_scoped on public.leads for UPDATE to authenticated
using ((( SELECT private.has_permission('leads.update'::text) AS has_permission) AND ( SELECT private.can_access_lead(leads.assigned_to) AS can_access_lead)))
with check ((( SELECT private.has_permission('leads.update'::text) AS has_permission) AND ((( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text])) OR (assigned_to = ( SELECT auth.uid() AS uid)) OR ((( SELECT private."current_role"() AS "current_role") = 'team_leader'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = leads.assigned_to) AND ((p.team_leader_id = ( SELECT auth.uid() AS uid)) OR (p.team_id = ( SELECT profiles.team_id
           FROM profiles
          WHERE (profiles.id = ( SELECT auth.uid() AS uid))))))))) OR ((( SELECT private."current_role"() AS "current_role") = 'marketing'::text) AND (assigned_to = ( SELECT auth.uid() AS uid))))));

drop policy if exists profiles_select_scoped on public.profiles;
create policy profiles_select_scoped on public.profiles for SELECT to authenticated
using (( SELECT private.can_access_user(profiles.id) AS can_access_user));

drop policy if exists profiles_update_controller on public.profiles;
create policy profiles_update_controller on public.profiles for UPDATE to authenticated
using (( SELECT private.has_permission('users.manage'::text) AS has_permission))
with check (( SELECT private.has_permission('users.manage'::text) AS has_permission));

drop policy if exists projects_delete_scoped on public.projects;
create policy projects_delete_scoped on public.projects for DELETE to authenticated
using (( SELECT private.has_permission('projects.manage'::text) AS has_permission));

drop policy if exists projects_insert_scoped on public.projects;
create policy projects_insert_scoped on public.projects for INSERT to authenticated
with check (( SELECT private.has_permission('projects.manage'::text) AS has_permission));

drop policy if exists projects_select_scoped on public.projects;
create policy projects_select_scoped on public.projects for SELECT to authenticated
using (( SELECT private.has_permission('projects.view'::text) AS has_permission));

drop policy if exists projects_update_scoped on public.projects;
create policy projects_update_scoped on public.projects for UPDATE to authenticated
using (( SELECT private.has_permission('projects.manage'::text) AS has_permission))
with check (( SELECT private.has_permission('projects.manage'::text) AS has_permission));

drop policy if exists reservations_delete_scoped on public.reservations;
create policy reservations_delete_scoped on public.reservations for DELETE to authenticated
using ((( SELECT private.has_permission('reservations.manage'::text) AS has_permission) AND (( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text]))));

drop policy if exists reservations_insert_scoped on public.reservations;
create policy reservations_insert_scoped on public.reservations for INSERT to authenticated
with check ((( SELECT private.has_permission('reservations.manage'::text) AS has_permission) AND ((sales_person = ( SELECT auth.uid() AS uid)) OR (( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text, 'team_leader'::text])))));

drop policy if exists reservations_select_scoped_v2 on public.reservations;
create policy reservations_select_scoped_v2 on public.reservations for SELECT to authenticated
using ((( SELECT private.has_permission('reservations.view'::text) AS has_permission) AND (( SELECT private.can_access_user(reservations.sales_person) AS can_access_user) OR ( SELECT private.has_permission('finance.view'::text) AS has_permission))));

drop policy if exists reservations_update_scoped on public.reservations;
create policy reservations_update_scoped on public.reservations for UPDATE to authenticated
using ((( SELECT private.has_permission('reservations.manage'::text) AS has_permission) AND (( SELECT private.can_access_user(reservations.sales_person) AS can_access_user) OR (( SELECT private."current_role"() AS "current_role") = 'finance'::text))))
with check ((( SELECT private.has_permission('reservations.manage'::text) AS has_permission) AND (( SELECT private.can_access_user(reservations.sales_person) AS can_access_user) OR (( SELECT private."current_role"() AS "current_role") = 'finance'::text))));

drop policy if exists tasks_delete_scoped_v2 on public.tasks;
create policy tasks_delete_scoped_v2 on public.tasks for DELETE to authenticated
using ((( SELECT private.has_permission('tasks.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(tasks.user_id) AS can_access_user)));

drop policy if exists tasks_insert_scoped on public.tasks;
create policy tasks_insert_scoped on public.tasks for INSERT to authenticated
with check ((( SELECT private.has_permission('tasks.manage'::text) AS has_permission) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (created_by = ( SELECT auth.uid() AS uid)) OR (( SELECT private."current_role"() AS "current_role") = ANY (ARRAY['admin'::text, 'ceo'::text, 'manager'::text, 'team_leader'::text])))));

drop policy if exists tasks_select_scoped_v2 on public.tasks;
create policy tasks_select_scoped_v2 on public.tasks for SELECT to authenticated
using ((( SELECT private.has_permission('tasks.view'::text) AS has_permission) AND ( SELECT private.can_access_user(tasks.user_id) AS can_access_user)));

drop policy if exists tasks_update_scoped on public.tasks;
create policy tasks_update_scoped on public.tasks for UPDATE to authenticated
using ((( SELECT private.has_permission('tasks.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(tasks.user_id) AS can_access_user)))
with check ((( SELECT private.has_permission('tasks.manage'::text) AS has_permission) AND ( SELECT private.can_access_user(tasks.user_id) AS can_access_user)));

drop policy if exists teams_delete_scoped on public.teams;
create policy teams_delete_scoped on public.teams for DELETE to authenticated
using (( SELECT private.has_permission('teams.manage'::text) AS has_permission));

drop policy if exists teams_insert_scoped on public.teams;
create policy teams_insert_scoped on public.teams for INSERT to authenticated
with check (( SELECT private.has_permission('teams.manage'::text) AS has_permission));

drop policy if exists teams_select_scoped on public.teams;
create policy teams_select_scoped on public.teams for SELECT to authenticated
using (( SELECT private.has_permission('teams.view'::text) AS has_permission));

drop policy if exists teams_update_scoped on public.teams;
create policy teams_update_scoped on public.teams for UPDATE to authenticated
using (( SELECT private.has_permission('teams.manage'::text) AS has_permission))
with check (( SELECT private.has_permission('teams.manage'::text) AS has_permission));

drop policy if exists units_delete_scoped on public.units;
create policy units_delete_scoped on public.units for DELETE to authenticated
using (( SELECT private.has_permission('units.manage'::text) AS has_permission));

drop policy if exists units_insert_scoped on public.units;
create policy units_insert_scoped on public.units for INSERT to authenticated
with check (( SELECT private.has_permission('units.manage'::text) AS has_permission));

drop policy if exists units_select_scoped on public.units;
create policy units_select_scoped on public.units for SELECT to authenticated
using (( SELECT private.has_permission('units.view'::text) AS has_permission));

drop policy if exists units_update_scoped on public.units;
create policy units_update_scoped on public.units for UPDATE to authenticated
using (( SELECT private.has_permission('units.manage'::text) AS has_permission))
with check (( SELECT private.has_permission('units.manage'::text) AS has_permission));

drop policy if exists user_preferences_delete_self on public.user_preferences;
create policy user_preferences_delete_self on public.user_preferences for DELETE to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));

drop policy if exists user_preferences_insert_self on public.user_preferences;
create policy user_preferences_insert_self on public.user_preferences for INSERT to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));

drop policy if exists user_preferences_select_self on public.user_preferences;
create policy user_preferences_select_self on public.user_preferences for SELECT to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));

drop policy if exists user_preferences_update_self on public.user_preferences;
create policy user_preferences_update_self on public.user_preferences for UPDATE to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));

drop policy if exists user_roles_delete_controller on public.user_roles;
create policy user_roles_delete_controller on public.user_roles for DELETE to authenticated
using (( SELECT private.has_permission('users.manage'::text) AS has_permission));

drop policy if exists user_roles_insert_controller on public.user_roles;
create policy user_roles_insert_controller on public.user_roles for INSERT to authenticated
with check ((( SELECT private.has_permission('users.manage'::text) AS has_permission) AND (lower(role) IN ( SELECT app_roles.key
   FROM app_roles))));

drop policy if exists user_roles_select_scoped on public.user_roles;
create policy user_roles_select_scoped on public.user_roles for SELECT to authenticated
using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.has_permission('users.view'::text) AS has_permission)));

drop policy if exists user_roles_update_controller on public.user_roles;
create policy user_roles_update_controller on public.user_roles for UPDATE to authenticated
using (( SELECT private.has_permission('users.manage'::text) AS has_permission))
with check ((( SELECT private.has_permission('users.manage'::text) AS has_permission) AND (lower(role) IN ( SELECT app_roles.key
   FROM app_roles))));
