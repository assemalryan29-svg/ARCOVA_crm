-- ARCOVA Phase 4: controlled legacy-data migration/integrity layer.
-- Non-destructive: no delete, merge, reassignment, or ID rewriting is performed here.

create table if not exists public.phase4_validation_results (
  run_id uuid not null,
  check_key text not null,
  check_type text not null,
  source_count bigint,
  target_count bigint,
  mismatch_count bigint,
  passed boolean not null,
  details jsonb,
  checked_at timestamptz not null default now(),
  primary key (run_id, check_key)
);

create table if not exists public.phase4_id_mapping (
  run_id uuid not null,
  entity_type text not null,
  source_id text not null,
  target_id text not null,
  mapping_status text not null default 'mapped',
  created_at timestamptz not null default now(),
  primary key (run_id, entity_type, source_id)
);

create table if not exists public.phase4_approval (
  run_id uuid primary key,
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid,
  notes text,
  constraint phase4_approval_consistency check ((approved = false and approved_at is null) or (approved = true and approved_at is not null))
);

create index if not exists idx_phase4_validation_passed on public.phase4_validation_results (run_id, passed);
create index if not exists idx_phase4_mapping_target on public.phase4_id_mapping (run_id, entity_type, target_id);

create or replace function public.phase4_can_approve(p_run_id uuid)
returns table(can_approve boolean, failed_checks bigint, pending_duplicates bigint, orphan_links bigint)
language sql security definer set search_path=public as $$
  with failed as (
    select count(*) n from public.phase4_validation_results
    where run_id=p_run_id and not passed
  ),
  dup as (
    select count(*) n from public.phase4_duplicate_candidates
    where review_status not in ('approved','rejected')
  ),
  orphans as (
    select
      (select count(*) from public.lead_logs l where l.lead_id is not null and not exists(select 1 from public.leads x where x.id=l.lead_id)) +
      (select count(*) from public.followups f where f.lead_id is not null and not exists(select 1 from public.leads x where x.id=f.lead_id)) +
      (select count(*) from public.calls c where c.lead_id is not null and not exists(select 1 from public.leads x where x.id=c.lead_id)) +
      (select count(*) from public.appointments a where a.lead_id is not null and not exists(select 1 from public.leads x where x.id=a.lead_id)) +
      (select count(*) from public.deals d where d.lead_id is not null and not exists(select 1 from public.leads x where x.id=d.lead_id)) +
      (select count(*) from public.deal_payments p where not exists(select 1 from public.deals d where d.id=p.deal_id)) +
      (select count(*) from public.reservations r where r.lead_id is not null and not exists(select 1 from public.leads x where x.id=r.lead_id)) +
      (select count(*) from public.tasks t where t.lead_id is not null and not exists(select 1 from public.leads x where x.id=t.lead_id)) n
  )
  select (failed.n=0 and dup.n=0 and orphans.n=0), failed.n, dup.n, orphans.n
  from failed, dup, orphans;
$$;

comment on table public.phase4_id_mapping is 'Controlled source-to-target identity map. No automatic ID rewriting or duplicate merging.';
comment on table public.phase4_approval is 'Explicit Phase 4 approval gate. Approval requires clean validation and reviewed duplicate candidates.';
comment on function public.phase4_can_approve(uuid) is 'Final Phase 4 gate: validation failures, pending duplicate candidates, and orphan relationships must all be zero.';
