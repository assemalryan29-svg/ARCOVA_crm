-- ARCOVA CRM
-- Sales-facing campaign attribution requires read-only campaign visibility.
insert into public.app_role_permissions(role_key, permission_key)
select r.role_key, 'campaigns.view'
from (values ('sales'),('team_leader'),('operations')) as r(role_key)
where not exists (
  select 1 from public.app_role_permissions p
  where p.role_key=r.role_key and p.permission_key='campaigns.view'
);