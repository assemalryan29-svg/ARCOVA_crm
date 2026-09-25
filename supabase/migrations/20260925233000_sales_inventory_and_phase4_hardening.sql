-- ARCOVA hardening: atomic inventory reservation + duplicate review control
-- Production schema change already applied and verified on Supabase.
-- This migration is the repository source-of-truth.

create index if not exists reservations_active_unit_idx
  on public.reservations(unit_id)
  where unit_id is not null and status in ('Pending','Confirmed','Active');

create or replace function public.reserve_unit_atomic(
  p_lead_id uuid,
  p_unit_id uuid,
  p_reservation_amount numeric,
  p_contract_value numeric default null,
  p_expires_at timestamptz default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_unit public.units%rowtype;
  v_reservation public.reservations%rowtype;
begin
  if v_actor is null then raise exception using errcode='42501', message='Authentication required.'; end if;
  if not private.has_permission('reservations.manage') then raise exception using errcode='42501', message='Reservation permission denied.'; end if;
  if p_lead_id is null or p_unit_id is null then raise exception using errcode='22023', message='Lead and unit are required.'; end if;
  if coalesce(p_reservation_amount,0) < 0 then raise exception using errcode='22023', message='Reservation amount must be non-negative.'; end if;

  select * into v_unit from public.units where id=p_unit_id for update;
  if not found then raise exception using errcode='P0002', message='Unit not found.'; end if;

  if exists (
    select 1 from public.reservations r
    where r.unit_id=p_unit_id
      and r.status in ('Pending','Confirmed','Active')
      and (r.expires_at is null or r.expires_at > now())
  ) then
    raise exception using errcode='23505', message='Unit is already reserved.';
  end if;

  if lower(coalesce(v_unit.status,'')) not in ('available','') then
    raise exception using errcode='23505', message='Unit is not available.';
  end if;

  insert into public.reservations(
    lead_id,unit_id,sales_person,reservation_amount,contract_value,status,expires_at,notes
  ) values (
    p_lead_id,p_unit_id,v_actor,p_reservation_amount,p_contract_value,'Pending',p_expires_at,p_notes
  ) returning * into v_reservation;

  update public.units set status='Reserved' where id=p_unit_id;

  insert into public.audit_logs(user_id,action,table_name,details)
  values(v_actor,'RESERVE_UNIT_ATOMIC','reservations',
         jsonb_build_object('reservation_id',v_reservation.id,'lead_id',p_lead_id,'unit_id',p_unit_id));

  return jsonb_build_object('ok',true,'reservation_id',v_reservation.id,'unit_id',p_unit_id,'status',v_reservation.status);
end;
$$;

revoke all on function public.reserve_unit_atomic(uuid,uuid,numeric,numeric,timestamptz,text) from public;
grant execute on function public.reserve_unit_atomic(uuid,uuid,numeric,numeric,timestamptz,text) to authenticated;

create or replace function public.release_reservation_atomic(
  p_reservation_id uuid,
  p_new_status text default 'Cancelled'
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_res public.reservations%rowtype;
begin
  if v_actor is null then raise exception using errcode='42501', message='Authentication required.'; end if;
  if not private.has_permission('reservations.manage') then raise exception using errcode='42501', message='Reservation permission denied.'; end if;
  if p_new_status not in ('Cancelled','Expired') then raise exception using errcode='22023', message='Invalid release status.'; end if;

  select * into v_res from public.reservations where id=p_reservation_id for update;
  if not found then raise exception using errcode='P0002', message='Reservation not found.'; end if;

  update public.reservations set status=p_new_status where id=p_reservation_id;

  if v_res.unit_id is not null and not exists (
    select 1 from public.reservations r
    where r.unit_id=v_res.unit_id and r.id<>p_reservation_id
      and r.status in ('Pending','Confirmed','Active')
      and (r.expires_at is null or r.expires_at > now())
  ) then
    update public.units set status='Available' where id=v_res.unit_id;
  end if;

  insert into public.audit_logs(user_id,action,table_name,details)
  values(v_actor,'RELEASE_RESERVATION_ATOMIC','reservations',
         jsonb_build_object('reservation_id',p_reservation_id,'status',p_new_status));

  return jsonb_build_object('ok',true,'reservation_id',p_reservation_id,'status',p_new_status);
end;
$$;

revoke all on function public.release_reservation_atomic(uuid,text) from public;
grant execute on function public.release_reservation_atomic(uuid,text) to authenticated;
