-- ARCOVA CRM — Phase 4 Data Migration / Cleanup
-- SAFE MODE: DRY RUN ONLY
-- Generated 2026-09-23
--
-- Rules:
-- 1) Never invent a mapping.
-- 2) Preserve UUIDs for canonical records.
-- 3) Child records are remapped by lead_id before duplicate lead deletion.
-- 4) Duplicate lead identity is based on normalized phone first, normalized email second.
-- 5) Canonical lead = oldest created_at within a confirmed identity group.
-- 6) Existing public.merge_leads_atomic() is the only approved merge path.
-- 7) Production deletion/merge is NOT executed by this file.

-- A. BASELINE COUNTS
select 'leads' table_name, count(*) row_count from public.leads
union all select 'lead_logs', count(*) from public.lead_logs
union all select 'followups', count(*) from public.followups
union all select 'profiles', count(*) from public.profiles
union all select 'user_roles', count(*) from public.user_roles
union all select 'projects', count(*) from public.projects
union all select 'units', count(*) from public.units
union all select 'tasks', count(*) from public.tasks;

-- B. ID / RELATIONSHIP VALIDATION
select 'leads.assigned_to' relation, count(*) orphan_count
from public.leads l
left join public.user_roles u on u.id=l.assigned_to
where l.assigned_to is not null and u.id is null
union all
select 'lead_logs.lead_id', count(*)
from public.lead_logs x
left join public.leads l on l.id=x.lead_id
where x.lead_id is not null and l.id is null
union all
select 'followups.lead_id', count(*)
from public.followups x
left join public.leads l on l.id=x.lead_id
where x.lead_id is not null and l.id is null
union all
select 'tasks.lead_id', count(*)
from public.tasks x
left join public.leads l on l.id=x.lead_id
where x.lead_id is not null and l.id is null;

-- C. NORMALIZATION VALIDATION
select
  count(*) as total_leads,
  count(*) filter (where phone_normalized is null) as missing_phone_normalized,
  count(*) filter (
    where email is not null and btrim(email) <> '' and email_normalized is null
  ) as missing_email_normalized
from public.leads;

-- D. DUPLICATE DETECTION (DRY RUN)
select phone_normalized, count(*) duplicate_count
from public.leads
where phone_normalized is not null
group by phone_normalized
having count(*) > 1
order by duplicate_count desc, phone_normalized;

-- E. ROLE / IDENTITY MAPPING VALIDATION
select
  count(*) as user_roles_count,
  (select count(*) from public.profiles) as profiles_count,
  (select count(*) from public.profiles p join public.user_roles u on u.id=p.id
    where lower(coalesce(p.role,'')) <> lower(coalesce(u.role,''))) as role_mismatches,
  (select count(*) from public.profiles p full join public.user_roles u on u.id=p.id
    where p.id is null or u.id is null) as identity_mismatches
from public.user_roles;

-- F. BACKUP CHECK FOR THE CURRENT LEADS DATASET
select
  (select count(*) from public.leads) as live_leads,
  (select count(*) from public.phase4_backup_20260923_leads) as backup_leads,
  case when
    (select count(*) from public.leads) =
    (select count(*) from public.phase4_backup_20260923_leads)
  then 'PASS' else 'FAIL' end as backup_count_check;

-- G. EXPECTED MERGE ACCOUNTING
-- For every confirmed duplicate group:
--   expected_deleted = group_size - 1
--   expected_remaining = 1
--   expected_related_rows_repointed = counts from child tables
--
-- DO NOT execute merge_leads_atomic() until:
--   * complete backup is confirmed
--   * all duplicate groups are reviewed/approved
--   * orphan_count = 0
--   * role/identity mismatches = 0
--   * before/after counts reconcile
