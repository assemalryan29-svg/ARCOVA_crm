-- ARCOVA Phase 2: canonical role context. Data is preserved; profiles.role is compatibility only.
create or replace function public.sync_profile_role_from_user_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare canonical_role text;
begin
  select ur.role into canonical_role from public.user_roles ur
  where ur.id = new.id and ur.active = true limit 1;
  if canonical_role is not null then new.role := canonical_role; end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_canonical_role on public.profiles;
create trigger trg_profiles_canonical_role
before insert or update on public.profiles
for each row execute function public.sync_profile_role_from_user_roles();

create or replace view public.user_access_context
with (security_invoker = true)
as
select ur.id as user_id, ur.email, ur.role as canonical_role, ur.active,
       p.full_name, p.phone, p.team_id, p.team_leader_id, p.manager_id
from public.user_roles ur
left join public.profiles p on p.id = ur.id;

comment on view public.user_access_context is
'Canonical authorization context. Role comes only from user_roles; profiles.role is compatibility data.';

create index if not exists idx_followups_lead_date on public.followups (lead_id, followup_date);
create index if not exists idx_calls_lead_at on public.calls (lead_id, call_at desc);
create index if not exists idx_appointments_lead_at on public.appointments (lead_id, scheduled_at);
create index if not exists idx_deals_lead_created on public.deals (lead_id, created_at desc);
create index if not exists idx_reservations_lead_created on public.reservations (lead_id, created_at desc);
create index if not exists idx_tasks_lead_due on public.tasks (lead_id, due_date);