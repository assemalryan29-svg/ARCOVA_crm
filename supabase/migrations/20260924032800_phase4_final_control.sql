-- ARCOVA CRM Phase 4 final control gate.
-- Non-destructive: adds audit/control metadata only.
-- Existing backup snapshots, ID mappings and duplicate review queue are preserved.
-- Approval remains explicit and is never granted automatically.

create table if not exists public.phase4_final_audit (
  run_id uuid primary key,
  backup_complete boolean not null default false,
  mapping_complete boolean not null default false,
  duplicate_scan_complete boolean not null default false,
  relationship_integrity_complete boolean not null default false,
  count_validation_complete boolean not null default false,
  failed_checks integer not null default 0,
  pending_duplicate_groups integer not null default 0,
  stale_mapping_rows integer not null default 0,
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.phase4_final_audit enable row level security;

create or replace function public.phase4_run_final_audit(p_run_id uuid)
returns table(
  backup_ok boolean,
  mapping_ok boolean,
  duplicates_ok boolean,
  relationships_ok boolean,
  counts_ok boolean,
  failed_checks integer,
  pending_duplicate_groups integer,
  stale_mapping_rows integer
)
language plpgsql
security invoker
as $$
declare
  v_backup boolean;
  v_mapping boolean;
  v_dups integer;
  v_stale integer;
  v_failed integer;
  v_orphans integer;
begin
  select count(*)=18 and coalesce(bool_and(passed),false)
    into v_backup
  from phase4_validation_results
  where run_id=p_run_id;

  select count(*) into v_stale
  from phase4_id_mapping m
  where m.mapping_status='mapped' and (
    (m.entity_type='leads' and not exists(select 1 from leads x where x.id::text=m.target_id)) or
    (m.entity_type='profiles' and not exists(select 1 from profiles x where x.id::text=m.target_id)) or
    (m.entity_type='user_roles' and not exists(select 1 from user_roles x where x.id::text=m.target_id)) or
    (m.entity_type='projects' and not exists(select 1 from projects x where x.id::text=m.target_id)) or
    (m.entity_type='teams' and not exists(select 1 from teams x where x.id::text=m.target_id))
  );
  v_mapping := v_stale=0;

  select count(*) into v_dups
  from phase4_duplicate_candidates
  where review_status='PENDING';

  select
    (select count(*) from lead_logs x where x.lead_id is not null and not exists(select 1 from leads l where l.id=x.lead_id)) +
    (select count(*) from lead_activities x where x.lead_id is not null and not exists(select 1 from leads l where l.id=x.lead_id)) +
    (select count(*) from followups x where x.lead_id is not null and not exists(select 1 from leads l where l.id=x.lead_id)) +
    (select count(*) from calls x where x.lead_id is not null and not exists(select 1 from leads l where l.id=x.lead_id)) +
    (select count(*) from appointments x where x.lead_id is not null and not exists(select 1 from leads l where l.id=x.lead_id)) +
    (select count(*) from deals x where x.lead_id is not null and not exists(select 1 from leads l where l.id=x.lead_id)) +
    (select count(*) from deal_payments x where not exists(select 1 from deals d where d.id=x.deal_id)) +
    (select count(*) from reservations x where x.lead_id is not null and not exists(select 1 from leads l where l.id=x.lead_id)) +
    (select count(*) from tasks x where x.lead_id is not null and not exists(select 1 from leads l where l.id=x.lead_id))
    into v_orphans;

  select count(*) filter(where not passed)
    into v_failed
  from phase4_validation_results
  where run_id=p_run_id;

  backup_ok:=coalesce(v_backup,false);
  mapping_ok:=v_mapping;
  duplicates_ok:=v_dups=0;
  relationships_ok:=v_orphans=0;
  counts_ok:=coalesce(v_backup,false);
  failed_checks:=coalesce(v_failed,0);
  pending_duplicate_groups:=v_dups;
  stale_mapping_rows:=v_stale;

  insert into phase4_final_audit(
    run_id,backup_complete,mapping_complete,duplicate_scan_complete,
    relationship_integrity_complete,count_validation_complete,
    failed_checks,pending_duplicate_groups,stale_mapping_rows,approved
  )
  values(
    p_run_id,backup_ok,v_mapping,duplicates_ok,relationships_ok,counts_ok,
    failed_checks,v_dups,v_stale,false
  )
  on conflict(run_id) do update set
    backup_complete=excluded.backup_complete,
    mapping_complete=excluded.mapping_complete,
    duplicate_scan_complete=excluded.duplicate_scan_complete,
    relationship_integrity_complete=excluded.relationship_integrity_complete,
    count_validation_complete=excluded.count_validation_complete,
    failed_checks=excluded.failed_checks,
    pending_duplicate_groups=excluded.pending_duplicate_groups,
    stale_mapping_rows=excluded.stale_mapping_rows,
    approved=false;

  return next;
end;
$$;
