-- ARCOVA CRM: consolidate historical Phase 4 backups.
-- Keeps the historical snapshot in a single private table and removes 18 public
-- backup/legacy tables from the production schema.

create schema if not exists private;

create table if not exists private.phase4_backup_archive (
  backup_date date not null,
  entity_type text not null,
  source_table text not null,
  record_key text not null,
  payload jsonb not null,
  archived_at timestamptz not null default now(),
  primary key (backup_date, entity_type, record_key)
);

do $$
declare
  t text;
  entities text[] := array[
    'activity_logs','appointments','calls','campaigns','deal_payments','deals',
    'followups','lead_activities','lead_folders','lead_logs','leads',
    'profiles','projects','reservations','tasks','teams','units','user_roles'
  ];
begin
  foreach t in array entities loop
    if to_regclass('public.phase4_backup_20260923_' || t) is not null then
      execute format(
        'insert into private.phase4_backup_archive (backup_date, entity_type, source_table, record_key, payload)
         select date %L, %L, %L, row_number() over ()::text, to_jsonb(x)
         from public.%I x
         on conflict (backup_date, entity_type, record_key) do nothing',
        '2026-09-23',
        t,
        'phase4_backup_20260923_' || t,
        'phase4_backup_20260923_' || t
      );
    end if;
  end loop;
end $$;

create or replace function public.phase4_run_validation(p_run_id uuid)
returns table(check_key text, passed boolean, source_count bigint, target_count bigint, mismatch_count bigint)
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  s bigint; t bigint; m bigint; e text;
  entities text[] := array[
    'profiles','user_roles','leads','lead_logs','lead_activities','activity_logs',
    'followups','calls','appointments','projects','units','deals','deal_payments',
    'reservations','tasks','teams','campaigns','lead_folders'
  ];
begin
  delete from public.phase4_validation_results where run_id=p_run_id;

  foreach e in array entities loop
    execute format(
      'select count(*) from private.phase4_backup_archive where backup_date=date %L and entity_type=%L',
      '2026-09-23', e
    ) into s;
    execute format('select count(*) from public.%I', e) into t;
    m := abs(s-t);

    insert into public.phase4_validation_results
      (run_id, check_key, source_label, source_count, target_count, mismatch_count, passed, notes, checked_at)
    values
      (p_run_id, e || '_count', 'archive_snapshot', s, t, m, m=0, null, now());
  end loop;

  return query
  select v.check_key, v.passed, v.source_count, v.target_count, v.mismatch_count
  from public.phase4_validation_results v
  where v.run_id=p_run_id
  order by v.check_key;
end;
$function$;

grant execute on function public.phase4_run_validation(uuid) to authenticated;

do $$
declare
  t text;
  tables text[] := array[
    'phase4_backup_20260923_activity_logs','phase4_backup_20260923_appointments',
    'phase4_backup_20260923_calls','phase4_backup_20260923_campaigns',
    'phase4_backup_20260923_deal_payments','phase4_backup_20260923_deals',
    'phase4_backup_20260923_followups','phase4_backup_20260923_lead_activities',
    'phase4_backup_20260923_lead_folders','phase4_backup_20260923_lead_logs',
    'phase4_backup_20260923_leads','phase4_backup_20260923_profiles',
    'phase4_backup_20260923_projects','phase4_backup_20260923_reservations',
    'phase4_backup_20260923_tasks','phase4_backup_20260923_teams',
    'phase4_backup_20260923_units','phase4_backup_20260923_user_roles'
  ];
begin
  foreach t in array tables loop
    execute format('drop table if exists public.%I', t);
  end loop;
end $$;
