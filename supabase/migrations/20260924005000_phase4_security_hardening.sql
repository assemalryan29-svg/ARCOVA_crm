-- ARCOVA Phase 4 security hardening
-- Non-destructive. No lead restoration, merge, or deletion.

create schema if not exists private;

create table if not exists private.phase4_baseline_counts_20260924 (
  table_name text primary key,
  row_count bigint not null,
  captured_at timestamptz not null default now()
);

alter table private.phase4_baseline_counts_20260924 enable row level security;

revoke all on table private.phase4_baseline_counts_20260924 from public, anon, authenticated;
revoke usage on schema private from public, anon, authenticated;

create policy "phase4_baseline_deny_api"
on private.phase4_baseline_counts_20260924
as restrictive for all
to anon, authenticated
using (false)
with check (false);

do $$
declare r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname='public' and tablename like 'phase4_%'
  loop
    execute format('drop policy if exists %I on public.%I', 'phase4_deny_api', r.tablename);
    execute format(
      'create policy %I on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      'phase4_deny_api', r.tablename
    );
  end loop;
end $$;

revoke execute on function public.phase4_can_approve(uuid) from public, anon, authenticated;
revoke execute on function public.phase4_run_validation(uuid) from public, anon, authenticated;
revoke execute on function public.phase4_run_final_audit(uuid) from public, anon, authenticated;
revoke execute on function public.sync_profile_role_after_user_role_change() from public, anon, authenticated;
revoke execute on function public.sync_profile_role_from_user_roles() from public, anon, authenticated;

alter function public.phase4_run_final_audit(uuid)
set search_path = public, pg_temp;
