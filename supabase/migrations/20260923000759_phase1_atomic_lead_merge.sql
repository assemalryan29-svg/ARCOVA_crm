create or replace function public.merge_leads_atomic(
  p_primary_lead_id uuid,
  p_duplicate_lead_ids uuid[],
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_id uuid;
  v_ids uuid[];
  v_primary record;
  v_duplicate_count integer;
  v_row_count integer;
  v_moved jsonb := '{}'::jsonb;
begin
  if p_primary_lead_id is null or p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'Primary lead and actor are required.';
  end if;
  if coalesce(array_length(p_duplicate_lead_ids, 1), 0) < 1
     or exists (select 1 from pg_catalog.unnest(p_duplicate_lead_ids) x where x is null) then
    raise exception using errcode = '22023', message = 'At least one valid duplicate lead is required.';
  end if;
  if p_primary_lead_id = any(p_duplicate_lead_ids) then
    raise exception using errcode = '22023', message = 'Primary lead cannot be in the duplicate list.';
  end if;
  if exists (
    select 1 from public.user_roles ur
    where ur.id = p_actor_user_id and ur.active = true and lower(coalesce(ur.role, '')) = 'admin'
  ) is not true then
    raise exception using errcode = '42501', message = 'Only an active Admin can merge leads.';
  end if;
  if exists (
    select 1 from public.app_role_permissions arp
    where arp.role_key = 'admin' and arp.permission_key = 'leads.update'
  ) is not true then
    raise exception using errcode = '42501', message = 'Lead merge permission is not configured.';
  end if;

  select array_agg(x order by x) into v_ids
  from (
    select p_primary_lead_id as x
    union
    select unnest(p_duplicate_lead_ids)
  ) ordered_ids;

  foreach v_id in array v_ids loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id::text, 0));
  end loop;

  select * into v_primary from public.leads where id = p_primary_lead_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Primary lead was not found.';
  end if;

  select count(*)::integer into v_duplicate_count from public.leads where id = any(p_duplicate_lead_ids);
  if v_duplicate_count <> array_length(p_duplicate_lead_ids, 1) then
    raise exception using errcode = 'P0002', message = 'One or more duplicate leads were not found.';
  end if;

  update public.activity_logs set lead_id = p_primary_lead_id where lead_id = any(p_duplicate_lead_ids);
  get diagnostics v_row_count = row_count;
  v_moved := v_moved || jsonb_build_object('activity_logs', v_row_count);
  update public.appointments set lead_id = p_primary_lead_id where lead_id = any(p_duplicate_lead_ids);
  get diagnostics v_row_count = row_count;
  v_moved := v_moved || jsonb_build_object('appointments', v_row_count);
  update public.calls set lead_id = p_primary_lead_id where lead_id = any(p_duplicate_lead_ids);
  get diagnostics v_row_count = row_count;
  v_moved := v_moved || jsonb_build_object('calls', v_row_count);
  update public.deals set lead_id = p_primary_lead_id where lead_id = any(p_duplicate_lead_ids);
  get diagnostics v_row_count = row_count;
  v_moved := v_moved || jsonb_build_object('deals', v_row_count);
  update public.followups set lead_id = p_primary_lead_id where lead_id = any(p_duplicate_lead_ids);
  get diagnostics v_row_count = row_count;
  v_moved := v_moved || jsonb_build_object('followups', v_row_count);
  update public.lead_activities set lead_id = p_primary_lead_id where lead_id = any(p_duplicate_lead_ids);
  get diagnostics v_row_count = row_count;
  v_moved := v_moved || jsonb_build_object('lead_activities', v_row_count);
  update public.lead_logs set lead_id = p_primary_lead_id where lead_id = any(p_duplicate_lead_ids);
  get diagnostics v_row_count = row_count;
  v_moved := v_moved || jsonb_build_object('lead_logs', v_row_count);
  update public.reservations set lead_id = p_primary_lead_id where lead_id = any(p_duplicate_lead_ids);
  get diagnostics v_row_count = row_count;
  v_moved := v_moved || jsonb_build_object('reservations', v_row_count);
  update public.tasks set lead_id = p_primary_lead_id where lead_id = any(p_duplicate_lead_ids);
  get diagnostics v_row_count = row_count;
  v_moved := v_moved || jsonb_build_object('tasks', v_row_count);

  delete from public.leads where id = any(p_duplicate_lead_ids);
  get diagnostics v_row_count = row_count;
  if v_row_count <> v_duplicate_count then
    raise exception using errcode = '40000', message = 'Not all duplicate leads could be deleted.';
  end if;

  insert into public.audit_logs (user_id, action, table_name, details)
  values (
    p_actor_user_id, 'MERGE_LEADS', 'leads',
    jsonb_build_object(
      'primary_lead_id', p_primary_lead_id,
      'duplicate_lead_ids', to_jsonb(p_duplicate_lead_ids),
      'deleted_duplicate_count', v_duplicate_count,
      'moved_related_records', v_moved
    )
  );

  return jsonb_build_object(
    'ok', true,
    'primary_lead_id', p_primary_lead_id,
    'deleted_duplicate_count', v_duplicate_count,
    'moved_related_records', v_moved
  );
end;
$function$;

revoke all on function public.merge_leads_atomic(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.merge_leads_atomic(uuid, uuid[], uuid) to service_role;