create or replace function public.sync_profile_role_after_user_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set role = new.role where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_user_roles_sync_profile_role on public.user_roles;
create trigger trg_user_roles_sync_profile_role
after insert or update of role, active on public.user_roles
for each row execute function public.sync_profile_role_after_user_role_change();

comment on column public.profiles.role is
'Compatibility field only. Authorization MUST use public.user_roles.role through private.current_role()/private.has_permission().';