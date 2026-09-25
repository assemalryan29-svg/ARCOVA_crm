-- ARCOVA CRM
-- Inventory workflow integrity: prevent direct reservation/sale status mutations.
-- Live production migration: inventory_workflow_integrity

begin;

create unique index if not exists units_project_unit_number_uniq
  on public.units(project_id, unit_number)
  where project_id is not null and unit_number is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='units_status_allowed_chk'
      and conrelid='public.units'::regclass
  ) then
    alter table public.units
      add constraint units_status_allowed_chk
      check (status in ('Available','Reserved','Sold'));
  end if;
end $$;

create or replace function private.guard_unit_status_transition()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_transition text := current_setting('arcova.unit_transition', true);
begin
  if tg_op='INSERT' then
    if new.status is null then new.status := 'Available'; end if;
    if new.status not in ('Available','Reserved','Sold') then
      raise exception using errcode='22023', message='Invalid unit status.';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if v_transition <> 'allowed' then
      raise exception using errcode='42501', message='Unit status can only be changed through the protected inventory workflow.';
    end if;

    if not (
      (old.status='Available' and new.status='Reserved')
      or (old.status='Reserved' and new.status in ('Available','Sold'))
    ) then
      raise exception using errcode='22023', message='Invalid unit status transition.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_unit_status_transition on public.units;
create trigger trg_guard_unit_status_transition
before insert or update of status on public.units
for each row execute function private.guard_unit_status_transition();

create or replace function private.reserve_unit_atomic_impl(
  p_lead_id uuid,
  p_unit_id uuid,
  p_reservation_amount numeric,
  p_contract_value numeric default null,
  p_expires_at timestamptz default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
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

  perform set_config('arcova.unit_transition','allowed',true);
  update public.units set status='Reserved' where id=p_unit_id;

  insert into public.audit_logs(user_id,action,table_name,details)
  values(v_actor,'RESERVE_UNIT_ATOMIC','reservations',
    jsonb_build_object('reservation_id',v_reservation.id,'lead_id',p_lead_id,'unit_id',p_unit_id));

  return jsonb_build_object('ok',true,'reservation_id',v_reservation.id,'unit_id',p_unit_id,'status',v_reservation.status);
end;
$$;

create or replace function private.release_reservation_atomic_impl(
  p_reservation_id uuid,
  p_new_status text default 'Cancelled'
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
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
    perform set_config('arcova.unit_transition','allowed',true);
    update public.units set status='Available' where id=v_res.unit_id;
  end if;

  insert into public.audit_logs(user_id,action,table_name,details)
  values(v_actor,'RELEASE_RESERVATION_ATOMIC','reservations',
    jsonb_build_object('reservation_id',p_reservation_id,'status',p_new_status));

  return jsonb_build_object('ok',true,'reservation_id',p_reservation_id,'status',p_new_status);
end;
$$;

create or replace function private.confirm_reservation_as_deal_impl(
  p_reservation_id uuid,
  p_deal_value numeric,
  p_down_payment numeric default 0,
  p_installment_months integer default null,
  p_payment_frequency text default 'monthly',
  p_contract_date date default current_date,
  p_commission numeric default 0,
  p_notes text default null
)
returns public.deals
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_actor uuid := auth.uid();
  v_res public.reservations;
  v_deal public.deals;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not private.has_permission('deals.manage') then raise exception 'DEALS_MANAGE_REQUIRED' using errcode='42501'; end if;
  if p_deal_value is null or p_deal_value<0 then raise exception 'INVALID_DEAL_VALUE' using errcode='22023'; end if;
  if p_down_payment<0 or p_down_payment>p_deal_value then raise exception 'INVALID_DOWN_PAYMENT' using errcode='22023'; end if;
  if p_installment_months is not null and p_installment_months<=0 then raise exception 'INVALID_INSTALLMENT_MONTHS' using errcode='22023'; end if;
  if p_payment_frequency not in ('monthly','quarterly','yearly') then raise exception 'INVALID_PAYMENT_FREQUENCY' using errcode='22023'; end if;

  select * into v_res from public.reservations where id=p_reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND' using errcode='P0002'; end if;
  if not private.can_access_user(v_res.sales_person) then raise exception 'RESERVATION_NOT_ACCESSIBLE' using errcode='42501'; end if;
  if v_res.status not in ('Pending','Confirmed') then raise exception 'RESERVATION_NOT_ACTIVE' using errcode='P0001'; end if;

  select * into v_deal from public.deals where reservation_id=p_reservation_id limit 1;
  if found then return v_deal; end if;

  insert into public.deals(
    lead_id,unit_id,sales_person,deal_value,commission,status,reservation_id,
    down_payment,installment_months,payment_frequency,contract_date,notes
  ) values(
    v_res.lead_id,v_res.unit_id,v_res.sales_person,p_deal_value,p_commission,'Pending',p_reservation_id,
    p_down_payment,p_installment_months,p_payment_frequency,p_contract_date,p_notes
  ) returning * into v_deal;

  update public.reservations set status='Confirmed' where id=v_res.id;
  perform set_config('arcova.unit_transition','allowed',true);
  update public.units set status='Sold' where id=v_res.unit_id;

  insert into public.audit_logs(user_id,action,table_name,details)
  values(v_actor,'CREATE_FROM_RESERVATION','deals',
    jsonb_build_object('deal_id',v_deal.id,'reservation_id',p_reservation_id,'unit_id',v_res.unit_id,'deal_value',p_deal_value));

  return v_deal;
end;
$$;

drop policy if exists reservations_insert_scoped on public.reservations;
create policy reservations_insert_workflow_only
on public.reservations for insert to authenticated
with check (false);

drop policy if exists reservations_update_scoped on public.reservations;
create policy reservations_update_workflow_only
on public.reservations for update to authenticated
using (false)
with check (false);

drop policy if exists reservations_delete_scoped on public.reservations;
create policy reservations_delete_workflow_only
on public.reservations for delete to authenticated
using (false);

drop policy if exists deals_insert_scoped on public.deals;
create policy deals_insert_workflow_only
on public.deals for insert to authenticated
with check (false);

drop policy if exists deals_update_scoped on public.deals;
create policy deals_update_workflow_only
on public.deals for update to authenticated
using (false)
with check (false);

drop policy if exists deals_delete_scoped on public.deals;
create policy deals_delete_workflow_only
on public.deals for delete to authenticated
using (false);

drop policy if exists deal_payments_insert_scoped on public.deal_payments;
create policy deal_payments_insert_workflow_only
on public.deal_payments for insert to authenticated
with check (false);

drop policy if exists deal_payments_update_scoped on public.deal_payments;
create policy deal_payments_workflow_only
on public.deal_payments for update to authenticated
using (false)
with check (false);

drop policy if exists deal_payments_delete_scoped on public.deal_payments;
create policy deal_payments_delete_workflow_only
on public.deal_payments for delete to authenticated
using (false);

commit;