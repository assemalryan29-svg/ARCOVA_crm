-- ARCOVA CRM
-- Security hardening: keep exposed RPC wrappers SECURITY INVOKER.
-- Cross-table privileged mutations live in private schema implementations.

create or replace function private.reserve_unit_atomic_impl(
  p_lead_id uuid,p_unit_id uuid,p_reservation_amount numeric,p_contract_value numeric default null,
  p_expires_at timestamptz default null,p_notes text default null
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_actor uuid:=auth.uid(); v_unit public.units%rowtype; v_reservation public.reservations%rowtype;
begin
  if v_actor is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  if not private.has_permission('reservations.manage') then raise exception using errcode='42501',message='Reservation permission denied.'; end if;
  if p_lead_id is null or p_unit_id is null then raise exception using errcode='22023',message='Lead and unit are required.'; end if;
  if coalesce(p_reservation_amount,0)<0 then raise exception using errcode='22023',message='Reservation amount must be non-negative.'; end if;
  select * into v_unit from public.units where id=p_unit_id for update;
  if not found then raise exception using errcode='P0002',message='Unit not found.'; end if;
  if exists(select 1 from public.reservations r where r.unit_id=p_unit_id and r.status in ('Pending','Confirmed','Active') and (r.expires_at is null or r.expires_at>now())) then
    raise exception using errcode='23505',message='Unit is already reserved.';
  end if;
  if lower(coalesce(v_unit.status,'')) not in ('available','') then
    raise exception using errcode='23505',message='Unit is not available.';
  end if;
  insert into public.reservations(lead_id,unit_id,sales_person,reservation_amount,contract_value,status,expires_at,notes)
  values(p_lead_id,p_unit_id,v_actor,p_reservation_amount,p_contract_value,'Pending',p_expires_at,p_notes)
  returning * into v_reservation;
  update public.units set status='Reserved' where id=p_unit_id;
  insert into public.audit_logs(user_id,action,table_name,details)
  values(v_actor,'RESERVE_UNIT_ATOMIC','reservations',jsonb_build_object('reservation_id',v_reservation.id,'lead_id',p_lead_id,'unit_id',p_unit_id));
  return jsonb_build_object('ok',true,'reservation_id',v_reservation.id,'unit_id',p_unit_id,'status',v_reservation.status);
end; $$;

create or replace function private.release_reservation_atomic_impl(p_reservation_id uuid,p_new_status text default 'Cancelled')
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_actor uuid:=auth.uid(); v_res public.reservations%rowtype;
begin
  if v_actor is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  if not private.has_permission('reservations.manage') then raise exception using errcode='42501',message='Reservation permission denied.'; end if;
  if p_new_status not in ('Cancelled','Expired') then raise exception using errcode='22023',message='Invalid release status.'; end if;
  select * into v_res from public.reservations where id=p_reservation_id for update;
  if not found then raise exception using errcode='P0002',message='Reservation not found.'; end if;
  update public.reservations set status=p_new_status where id=p_reservation_id;
  if v_res.unit_id is not null and not exists(
    select 1 from public.reservations r
    where r.unit_id=v_res.unit_id and r.id<>p_reservation_id
      and r.status in ('Pending','Confirmed','Active')
      and (r.expires_at is null or r.expires_at>now())
  ) then update public.units set status='Available' where id=v_res.unit_id; end if;
  insert into public.audit_logs(user_id,action,table_name,details)
  values(v_actor,'RELEASE_RESERVATION_ATOMIC','reservations',jsonb_build_object('reservation_id',p_reservation_id,'status',p_new_status));
  return jsonb_build_object('ok',true,'reservation_id',p_reservation_id,'status',p_new_status);
end; $$;

create or replace function private.confirm_reservation_as_deal_impl(
  p_reservation_id uuid,p_deal_value numeric,p_down_payment numeric default 0,p_installment_months integer default null,
  p_payment_frequency text default 'monthly',p_contract_date date default current_date,p_commission numeric default 0,p_notes text default null
)
returns public.deals language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_actor uuid:=auth.uid(); v_res public.reservations; v_deal public.deals;
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
  insert into public.deals(lead_id,unit_id,sales_person,deal_value,commission,status,reservation_id,down_payment,installment_months,payment_frequency,contract_date,notes)
  values(v_res.lead_id,v_res.unit_id,v_res.sales_person,p_deal_value,p_commission,'Pending',p_reservation_id,p_down_payment,p_installment_months,p_payment_frequency,p_contract_date,p_notes)
  returning * into v_deal;
  update public.reservations set status='Confirmed' where id=v_res.id;
  update public.units set status='Sold' where id=v_res.unit_id;
  insert into public.audit_logs(user_id,action,table_name,details)
  values(v_actor,'CREATE_FROM_RESERVATION','deals',jsonb_build_object('deal_id',v_deal.id,'reservation_id',p_reservation_id,'unit_id',v_res.unit_id,'deal_value',p_deal_value));
  return v_deal;
end; $$;

create or replace function private.generate_deal_payment_schedule_impl(p_deal_id uuid,p_first_due_date date default current_date)
returns integer language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_actor uuid:=auth.uid(); v_deal public.deals; v_count integer; v_base numeric; v_balance numeric; v_frequency text;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not private.has_permission('deals.manage') then raise exception 'DEALS_MANAGE_REQUIRED' using errcode='42501'; end if;
  select * into v_deal from public.deals where id=p_deal_id for update;
  if not found then raise exception 'DEAL_NOT_FOUND' using errcode='P0002'; end if;
  if not private.can_access_user(v_deal.sales_person) then raise exception 'DEAL_NOT_ACCESSIBLE' using errcode='42501'; end if;
  if v_deal.installment_months is null or v_deal.installment_months<=0 then raise exception 'INSTALLMENT_MONTHS_REQUIRED' using errcode='22023'; end if;
  if coalesce(v_deal.down_payment,0)>v_deal.deal_value then raise exception 'DOWN_PAYMENT_EXCEEDS_DEAL' using errcode='22023'; end if;
  if exists(select 1 from public.deal_payments where deal_id=p_deal_id) then raise exception 'PAYMENT_SCHEDULE_ALREADY_EXISTS' using errcode='P0001'; end if;
  v_frequency:=coalesce(v_deal.payment_frequency,'monthly');
  v_count:=case when v_frequency='monthly' then v_deal.installment_months when v_frequency='quarterly' then ceil(v_deal.installment_months/3.0)::int else ceil(v_deal.installment_months/12.0)::int end;
  if v_count<=0 then raise exception 'INVALID_INSTALLMENT_COUNT' using errcode='22023'; end if;
  v_balance:=greatest(v_deal.deal_value-coalesce(v_deal.down_payment,0),0); v_base:=round(v_balance/v_count,2);
  insert into public.deal_payments(deal_id,installment_no,due_date,amount,status)
  select p_deal_id,gs,
    case when v_frequency='monthly' then (p_first_due_date+((gs-1)||' month')::interval)::date
         when v_frequency='quarterly' then (p_first_due_date+(((gs-1)*3)||' month')::interval)::date
         else (p_first_due_date+(((gs-1)*12)||' month')::interval)::date end,
    case when gs=v_count then round(v_balance-v_base*(v_count-1),2) else v_base end,'Pending'
  from generate_series(1,v_count) gs;
  insert into public.audit_logs(user_id,action,table_name,details)
  values(v_actor,'GENERATE_PAYMENT_SCHEDULE','deal_payments',jsonb_build_object('deal_id',p_deal_id,'installments',v_count,'frequency',v_frequency));
  return v_count;
end; $$;

create or replace function public.reserve_unit_atomic(
  p_lead_id uuid,p_unit_id uuid,p_reservation_amount numeric,p_contract_value numeric default null,
  p_expires_at timestamptz default null,p_notes text default null
)
returns jsonb language sql security invoker
set search_path=public,private
as $$ select private.reserve_unit_atomic_impl(p_lead_id,p_unit_id,p_reservation_amount,p_contract_value,p_expires_at,p_notes); $$;

create or replace function public.release_reservation_atomic(p_reservation_id uuid,p_new_status text default 'Cancelled')
returns jsonb language sql security invoker
set search_path=public,private
as $$ select private.release_reservation_atomic_impl(p_reservation_id,p_new_status); $$;

create or replace function public.confirm_reservation_as_deal(
  p_reservation_id uuid,p_deal_value numeric,p_down_payment numeric default 0,p_installment_months integer default null,
  p_payment_frequency text default 'monthly',p_contract_date date default current_date,p_commission numeric default 0,p_notes text default null
)
returns public.deals language sql security invoker
set search_path=public,private
as $$ select private.confirm_reservation_as_deal_impl(
  p_reservation_id,p_deal_value,p_down_payment,p_installment_months,p_payment_frequency,p_contract_date,p_commission,p_notes
); $$;

create or replace function public.generate_deal_payment_schedule(p_deal_id uuid,p_first_due_date date default current_date)
returns integer language sql security invoker
set search_path=public,private
as $$ select private.generate_deal_payment_schedule_impl(p_deal_id,p_first_due_date); $$;

revoke execute on function private.reserve_unit_atomic_impl(uuid,uuid,numeric,numeric,timestamptz,text) from public,anon;
revoke execute on function private.release_reservation_atomic_impl(uuid,text) from public,anon;
revoke execute on function private.confirm_reservation_as_deal_impl(uuid,numeric,numeric,integer,text,date,numeric,text) from public,anon;
revoke execute on function private.generate_deal_payment_schedule_impl(uuid,date) from public,anon;
grant execute on function private.reserve_unit_atomic_impl(uuid,uuid,numeric,numeric,timestamptz,text) to authenticated;
grant execute on function private.release_reservation_atomic_impl(uuid,text) to authenticated;
grant execute on function private.confirm_reservation_as_deal_impl(uuid,numeric,numeric,integer,text,date,numeric,text) to authenticated;
grant execute on function private.generate_deal_payment_schedule_impl(uuid,date) to authenticated;

revoke execute on function public.reserve_unit_atomic(uuid,uuid,numeric,numeric,timestamptz,text) from public,anon;
revoke execute on function public.release_reservation_atomic(uuid,text) from public,anon;
revoke execute on function public.confirm_reservation_as_deal(uuid,numeric,numeric,integer,text,date,numeric,text) from public,anon;
revoke execute on function public.generate_deal_payment_schedule(uuid,date) from public,anon;
grant execute on function public.reserve_unit_atomic(uuid,uuid,numeric,numeric,timestamptz,text) to authenticated;
grant execute on function public.release_reservation_atomic(uuid,text) to authenticated;
grant execute on function public.confirm_reservation_as_deal(uuid,numeric,numeric,integer,text,date,numeric,text) to authenticated;
grant execute on function public.generate_deal_payment_schedule(uuid,date) to authenticated;
