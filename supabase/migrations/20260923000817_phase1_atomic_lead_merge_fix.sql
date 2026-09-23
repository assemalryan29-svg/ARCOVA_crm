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
  v_email text;
  v_lead_source text;
  v_assigned_to uuid;
  v_next_follow_up timestamptz;
  v_budget numeric;
  v_unit_type text;
  v_preferred_area text;
  v_desired_unit_type text;
  v_folder text;
  v_preferred_location text;
  v_project_id uuid;
  v_field_name text;
  v_phone_normalized text;
  v_email_normalized text;
  v_external_source text;
  v_external_lead_id text;
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

  select
    (array_agg(d.email order by d.created_at) filter (where nullif(d.email, '') is not null))[1],
    (array_agg(d.lead_source order by d.created_at) filter (where nullif(d.lead_source, '') is not null))[1],
    (array_agg(d.assigned_to order by d.created_at) filter (where d.assigned_to is not null))[1],
    (array_agg(d.next_follow_up order by d.created_at) filter (where d.next_follow_up is not null))[1],
    (array_agg(d.budget order by d.created_at) filter (where d.budget is not null))[1],
    (array_agg(d.unit_type order by d.created_at) filter (where nullif(d.unit_type, '') is not null))[1],
    (array_agg(d.preferred_area order by d.created_at) filter (where nullif(d.preferred_area, '') is not null))[1],
    (array_agg(d.desired_unit_type order by d.created_at) filter (where nullif(d.desired_unit_type, '') is not null))[1],
    (array_agg(d.folder order by d.created_at) filter (where nullif(d.folder, '') is not null))[1],
    (array_agg(d.preferred_location order by d.created_at) filter (where nullif(d.preferred_location, '') is not null))[1],
    (array_agg(d.project_id order by d.created_at) filter (where d.project_id is not null))[1],
    (array_agg(d."اسم_الحقل" order by d.created_at) filter (where nullif(d."اسم_الحقل", '') is not null))[1],
    (array_agg(d.phone_normalized order by d.created_at) filter (where nullif(d.phone_normalized, '') is not null))[1],
    (array_agg(d.email_normalized order by d.created_at) filter (where nullif(d.email_normalized, '') is not null))[1],
    (array_agg(d.external_source order by d.created_at) filter (where nullif(d.external_source, '') is not null))[1],
    (array_agg(d.external_lead_id order by d.created_at) filter (where nullif(d.external_lead_id, '') is not null))[1]
  into
    v_email, v_lead_source, v_assigned_to, v_next_follow_up, v_budget,
    v_unit_type, v_preferred_area, v_desired_unit_type, v_folder,
    v_preferred_location, v_project_id, v_field_name, v_phone_normalized,
    v_email_normalized, v_external_source, v_external_lead_id
  from public.leads d
  where d.id = any(p_duplicate_lead_ids);

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

  update public.leads l
     set email = coalesce(nullif(l.email, ''), v_email),
         lead_source = coalesce(nullif(l.lead_source, ''), v_lead_source),
         assigned_to = coalesce(l.assigned_to, v_assigned_to),
         next_follow_up = coalesce(l.next_follow_up, v_next_follow_up),
         budget = coalesce(l.budget, v_budget),
         unit_type = coalesce(nullif(l.unit_type, ''), v_unit_type),
         preferred_area = coalesce(nullif(l.preferred_area, ''), v_preferred_area),
         desired_unit_type = coalesce(nullif(l.desired_unit_type, ''), v_desired_unit_type),
         folder = coalesce(nullif(l.folder, ''), v_folder),
         preferred_location = coalesce(nullif(l.preferred_location, ''), v_preferred_location),
         project_id = coalesce(l.project_id, v_project_id),
         "اسم_الحقل" = coalesce(nullif(l."اسم_الحقل", ''), v_field_name),
         phone_normalized = coalesce(nullif(l.phone_normalized, ''), v_phone_normalized),
         email_normalized = coalesce(nullif(l.email_normalized, ''), v_email_normalized),
         external_source = coalesce(nullif(l.external_source, ''), v_external_source),
         external_lead_id = coalesce(nullif(l.external_lead_id, ''), v_external_lead_id)
   where l.id = p_primary_lead_id;

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