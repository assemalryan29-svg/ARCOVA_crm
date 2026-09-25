-- ARCOVA CRM
-- Sales Pipeline + Opportunity + Deal/Payment workflow
-- Mirrors live hardening already applied to production.

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  assigned_to uuid not null references auth.users(id) on delete restrict,
  stage text not null default 'Qualified'
    check (stage in ('New','Qualified','Site Visit','Negotiation','Reserved','Won','Lost')),
  status text not null default 'Open'
    check (status in ('Open','Won','Lost')),
  estimated_value numeric check (estimated_value is null or estimated_value >= 0),
  probability numeric not null default 20 check (probability >= 0 and probability <= 100),
  expected_close_date date,
  source text,
  lost_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists opportunities_lead_idx on public.opportunities(lead_id);
create index if not exists opportunities_assigned_idx on public.opportunities(assigned_to);
create index if not exists opportunities_stage_idx on public.opportunities(stage,status);
create index if not exists opportunities_project_idx on public.opportunities(project_id);
create index if not exists opportunities_close_date_idx on public.opportunities(expected_close_date);
create index if not exists opportunities_unit_idx on public.opportunities(unit_id);

create table if not exists public.opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  from_status text,
  to_status text not null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists opportunity_stage_history_opportunity_idx
  on public.opportunity_stage_history(opportunity_id, created_at desc);
create index if not exists opportunity_stage_history_changed_by_idx
  on public.opportunity_stage_history(changed_by);

alter table public.opportunities enable row level security;
alter table public.opportunity_stage_history enable row level security;

drop policy if exists opportunities_select_scoped on public.opportunities;
create policy opportunities_select_scoped
on public.opportunities
for select to authenticated
using (
  (select private.has_permission('pipeline.view'))
  and (select private.can_access_user(assigned_to))
);

drop policy if exists opportunities_insert_scoped on public.opportunities;
create policy opportunities_insert_scoped
on public.opportunities
for insert to authenticated
with check (
  (select private.has_permission('pipeline.manage'))
  and (select private.can_access_user(assigned_to))
  and exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and (select private.can_access_lead(l.assigned_to))
  )
);

drop policy if exists opportunities_update_scoped on public.opportunities;
create policy opportunities_update_scoped
on public.opportunities
for update to authenticated
using (
  (select private.has_permission('pipeline.manage'))
  and (select private.can_access_user(assigned_to))
)
with check (
  (select private.has_permission('pipeline.manage'))
  and (select private.can_access_user(assigned_to))
);

drop policy if exists opportunities_delete_scoped on public.opportunities;
create policy opportunities_delete_scoped
on public.opportunities
for delete to authenticated
using (
  (select private.has_permission('pipeline.manage'))
  and (
    (select private.current_role()) = any(array['admin','ceo','manager'])
    or (select private.can_access_user(assigned_to))
  )
);

drop policy if exists opportunity_stage_history_select_scoped on public.opportunity_stage_history;
create policy opportunity_stage_history_select_scoped
on public.opportunity_stage_history
for select to authenticated
using (
  (select private.has_permission('pipeline.view'))
  and exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_id
      and (select private.can_access_user(o.assigned_to))
  )
);

drop policy if exists opportunity_stage_history_insert_scoped on public.opportunity_stage_history;
create policy opportunity_stage_history_insert_scoped
on public.opportunity_stage_history
for insert to authenticated
with check (
  (select private.has_permission('pipeline.manage'))
  and changed_by = (select auth.uid())
  and exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_id
      and (select private.can_access_user(o.assigned_to))
  )
);

insert into public.app_permissions(key, module, action, name_ar, description)
select
  'pipeline.manage',
  'pipeline',
  'manage',
  'إدارة الـPipeline',
  'إنشاء وتحديث ونقل مراحل الفرص'
where not exists (
  select 1 from public.app_permissions where key = 'pipeline.manage'
);

insert into public.app_role_permissions(role_key, permission_key)
select r.role_key, 'pipeline.manage'
from (values ('admin'),('ceo'),('manager'),('team_leader'),('sales')) r(role_key)
where not exists (
  select 1
  from public.app_role_permissions arp
  where arp.role_key = r.role_key
    and arp.permission_key = 'pipeline.manage'
);

create or replace function public.create_opportunity(
  p_lead_id uuid,
  p_project_id uuid default null,
  p_assigned_to uuid default null,
  p_estimated_value numeric default null,
  p_probability numeric default 20,
  p_expected_close_date date default null,
  p_stage text default 'Qualified',
  p_notes text default null
)
returns public.opportunities
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_assigned uuid := coalesce(p_assigned_to, v_actor);
  v_lead_assigned uuid;
  v_opportunity public.opportunities;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  if not private.has_permission('pipeline.manage') then
    raise exception 'PIPELINE_MANAGE_REQUIRED' using errcode='42501';
  end if;

  if not private.can_access_user(v_assigned) then
    raise exception 'ASSIGNEE_NOT_ALLOWED' using errcode='42501';
  end if;

  select assigned_to
  into v_lead_assigned
  from public.leads
  where id = p_lead_id;

  if not found then
    raise exception 'LEAD_NOT_FOUND' using errcode='P0002';
  end if;

  if not private.can_access_lead(v_lead_assigned) then
    raise exception 'LEAD_NOT_ACCESSIBLE' using errcode='42501';
  end if;

  if p_probability < 0 or p_probability > 100 then
    raise exception 'INVALID_PROBABILITY' using errcode='22023';
  end if;

  if p_stage not in ('New','Qualified','Site Visit','Negotiation','Reserved','Won','Lost') then
    raise exception 'INVALID_STAGE' using errcode='22023';
  end if;

  insert into public.opportunities(
    lead_id,
    project_id,
    assigned_to,
    estimated_value,
    probability,
    expected_close_date,
    stage,
    status,
    notes
  )
  values (
    p_lead_id,
    p_project_id,
    v_assigned,
    p_estimated_value,
    p_probability,
    p_expected_close_date,
    p_stage,
    case
      when p_stage = 'Won' then 'Won'
      when p_stage = 'Lost' then 'Lost'
      else 'Open'
    end,
    p_notes
  )
  returning * into v_opportunity;

  insert into public.opportunity_stage_history(
    opportunity_id,
    from_stage,
    to_stage,
    from_status,
    to_status,
    changed_by,
    notes
  )
  values (
    v_opportunity.id,
    null,
    v_opportunity.stage,
    null,
    v_opportunity.status,
    v_actor,
    'Opportunity created'
  );

  insert into public.audit_logs(user_id, action, table_name, details)
  values (
    v_actor,
    'CREATE',
    'opportunities',
    jsonb_build_object(
      'opportunity_id', v_opportunity.id,
      'lead_id', p_lead_id,
      'stage', v_opportunity.stage
    )
  );

  return v_opportunity;
end;
$$;

create or replace function public.advance_opportunity_stage(
  p_opportunity_id uuid,
  p_stage text,
  p_status text default null,
  p_notes text default null,
  p_lost_reason text default null
)
returns public.opportunities
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.opportunities;
  v_new public.opportunities;
  v_status text := coalesce(
    p_status,
    case
      when p_stage = 'Won' then 'Won'
      when p_stage = 'Lost' then 'Lost'
      else 'Open'
    end
  );
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  if not private.has_permission('pipeline.manage') then
    raise exception 'PIPELINE_MANAGE_REQUIRED' using errcode='42501';
  end if;

  if p_stage not in ('New','Qualified','Site Visit','Negotiation','Reserved','Won','Lost') then
    raise exception 'INVALID_STAGE' using errcode='22023';
  end if;

  if v_status not in ('Open','Won','Lost') then
    raise exception 'INVALID_STATUS' using errcode='22023';
  end if;

  select *
  into v_old
  from public.opportunities
  where id = p_opportunity_id
  for update;

  if not found then
    raise exception 'OPPORTUNITY_NOT_FOUND' using errcode='P0002';
  end if;

  if not private.can_access_user(v_old.assigned_to) then
    raise exception 'OPPORTUNITY_NOT_ACCESSIBLE' using errcode='42501';
  end if;

  update public.opportunities
  set
    stage = p_stage,
    status = v_status,
    lost_reason = case when p_stage = 'Lost' then p_lost_reason else null end,
    closed_at = case
      when v_status in ('Won','Lost') then coalesce(closed_at, now())
      else null
    end,
    updated_at = now()
  where id = p_opportunity_id
  returning * into v_new;

  insert into public.opportunity_stage_history(
    opportunity_id,
    from_stage,
    to_stage,
    from_status,
    to_status,
    changed_by,
    notes
  )
  values (
    v_old.id,
    v_old.stage,
    v_new.stage,
    v_old.status,
    v_new.status,
    v_actor,
    p_notes
  );

  insert into public.audit_logs(user_id, action, table_name, details)
  values (
    v_actor,
    'UPDATE_STAGE',
    'opportunities',
    jsonb_build_object(
      'opportunity_id', v_new.id,
      'from_stage', v_old.stage,
      'to_stage', v_new.stage,
      'from_status', v_old.status,
      'to_status', v_new.status
    )
  );

  return v_new;
end;
$$;

create or replace function public.confirm_reservation_as_deal(
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
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_res public.reservations;
  v_deal public.deals;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  if not private.has_permission('deals.manage') then
    raise exception 'DEALS_MANAGE_REQUIRED' using errcode='42501';
  end if;

  if p_deal_value is null or p_deal_value < 0 then
    raise exception 'INVALID_DEAL_VALUE' using errcode='22023';
  end if;

  if p_down_payment < 0 or p_down_payment > p_deal_value then
    raise exception 'INVALID_DOWN_PAYMENT' using errcode='22023';
  end if;

  if p_installment_months is not null and p_installment_months <= 0 then
    raise exception 'INVALID_INSTALLMENT_MONTHS' using errcode='22023';
  end if;

  if p_payment_frequency not in ('monthly','quarterly','yearly') then
    raise exception 'INVALID_PAYMENT_FREQUENCY' using errcode='22023';
  end if;

  select *
  into v_res
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode='P0002';
  end if;

  if not private.can_access_user(v_res.sales_person) then
    raise exception 'RESERVATION_NOT_ACCESSIBLE' using errcode='42501';
  end if;

  if v_res.status not in ('Pending','Confirmed') then
    raise exception 'RESERVATION_NOT_ACTIVE' using errcode='P0001';
  end if;

  select *
  into v_deal
  from public.deals
  where reservation_id = p_reservation_id
  limit 1;

  if found then
    return v_deal;
  end if;

  insert into public.deals(
    lead_id,
    unit_id,
    sales_person,
    deal_value,
    commission,
    status,
    reservation_id,
    down_payment,
    installment_months,
    payment_frequency,
    contract_date,
    notes
  )
  values (
    v_res.lead_id,
    v_res.unit_id,
    v_res.sales_person,
    p_deal_value,
    p_commission,
    'Pending',
    p_reservation_id,
    p_down_payment,
    p_installment_months,
    p_payment_frequency,
    p_contract_date,
    p_notes
  )
  returning * into v_deal;

  update public.reservations
  set status = 'Confirmed'
  where id = v_res.id;

  update public.units
  set status = 'Sold'
  where id = v_res.unit_id;

  insert into public.audit_logs(user_id, action, table_name, details)
  values (
    v_actor,
    'CREATE_FROM_RESERVATION',
    'deals',
    jsonb_build_object(
      'deal_id', v_deal.id,
      'reservation_id', p_reservation_id,
      'unit_id', v_res.unit_id,
      'deal_value', p_deal_value
    )
  );

  return v_deal;
end;
$$;

create or replace function public.generate_deal_payment_schedule(
  p_deal_id uuid,
  p_first_due_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_deal public.deals;
  v_count integer;
  v_base numeric;
  v_balance numeric;
  v_frequency text;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  if not private.has_permission('deals.manage') then
    raise exception 'DEALS_MANAGE_REQUIRED' using errcode='42501';
  end if;

  select *
  into v_deal
  from public.deals
  where id = p_deal_id
  for update;

  if not found then
    raise exception 'DEAL_NOT_FOUND' using errcode='P0002';
  end if;

  if not private.can_access_user(v_deal.sales_person) then
    raise exception 'DEAL_NOT_ACCESSIBLE' using errcode='42501';
  end if;

  if v_deal.installment_months is null or v_deal.installment_months <= 0 then
    raise exception 'INSTALLMENT_MONTHS_REQUIRED' using errcode='22023';
  end if;

  if coalesce(v_deal.down_payment, 0) > v_deal.deal_value then
    raise exception 'DOWN_PAYMENT_EXCEEDS_DEAL' using errcode='22023';
  end if;

  if exists (
    select 1
    from public.deal_payments
    where deal_id = p_deal_id
  ) then
    raise exception 'PAYMENT_SCHEDULE_ALREADY_EXISTS' using errcode='P0001';
  end if;

  v_frequency := coalesce(v_deal.payment_frequency, 'monthly');

  v_count := case
    when v_frequency = 'monthly' then v_deal.installment_months
    when v_frequency = 'quarterly' then ceil(v_deal.installment_months / 3.0)::int
    else ceil(v_deal.installment_months / 12.0)::int
  end;

  if v_count <= 0 then
    raise exception 'INVALID_INSTALLMENT_COUNT' using errcode='22023';
  end if;

  v_balance := greatest(v_deal.deal_value - coalesce(v_deal.down_payment, 0), 0);
  v_base := round(v_balance / v_count, 2);

  insert into public.deal_payments(
    deal_id,
    installment_no,
    due_date,
    amount,
    status
  )
  select
    p_deal_id,
    gs,
    case
      when v_frequency = 'monthly' then (p_first_due_date + ((gs - 1) || ' month')::interval)::date
      when v_frequency = 'quarterly' then (p_first_due_date + (((gs - 1) * 3) || ' month')::interval)::date
      else (p_first_due_date + (((gs - 1) * 12) || ' month')::interval)::date
    end,
    case
      when gs = v_count then round(v_balance - v_base * (v_count - 1), 2)
      else v_base
    end,
    'Pending'
  from generate_series(1, v_count) gs;

  insert into public.audit_logs(user_id, action, table_name, details)
  values (
    v_actor,
    'GENERATE_PAYMENT_SCHEDULE',
    'deal_payments',
    jsonb_build_object(
      'deal_id', p_deal_id,
      'installments', v_count,
      'frequency', v_frequency
    )
  );

  return v_count;
end;
$$;

create or replace function public.record_deal_payment(
  p_payment_id uuid,
  p_paid_at timestamptz default now(),
  p_notes text default null
)
returns public.deal_payments
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_payment public.deal_payments;
  v_sales_person uuid;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  if not private.has_permission('finance.manage') then
    raise exception 'FINANCE_MANAGE_REQUIRED' using errcode='42501';
  end if;

  select *
  into v_payment
  from public.deal_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode='P0002';
  end if;

  select sales_person
  into v_sales_person
  from public.deals
  where id = v_payment.deal_id;

  if not found then
    raise exception 'DEAL_NOT_FOUND' using errcode='P0002';
  end if;

  if not private.can_access_user(v_sales_person)
     and not private.has_permission('finance.view') then
    raise exception 'PAYMENT_NOT_ACCESSIBLE' using errcode='42501';
  end if;

  update public.deal_payments
  set
    status = 'Paid',
    paid_at = coalesce(p_paid_at, now()),
    notes = coalesce(p_notes, notes)
  where id = p_payment_id
  returning * into v_payment;

  insert into public.audit_logs(user_id, action, table_name, details)
  values (
    v_actor,
    'PAYMENT_RECORDED',
    'deal_payments',
    jsonb_build_object(
      'payment_id', p_payment_id,
      'deal_id', v_payment.deal_id,
      'amount', v_payment.amount
    )
  );

  return v_payment;
end;
$$;

create or replace view public.crm_pipeline_stage_summary
with (security_invoker=true)
as
select
  stage,
  status,
  count(*)::int as opportunities,
  coalesce(sum(estimated_value), 0)::numeric as pipeline_value,
  coalesce(sum(estimated_value * probability / 100.0), 0)::numeric as weighted_value
from public.opportunities
group by stage, status;

grant select on public.crm_pipeline_stage_summary to authenticated;

create or replace view public.crm_sales_performance
with (security_invoker=true)
as
select
  d.sales_person,
  p.full_name,
  p.email,
  count(*) filter (where d.status = 'Won')::int as won_deals,
  count(*) filter (where d.status = 'Pending')::int as pending_deals,
  count(*) filter (where d.status = 'Cancelled')::int as cancelled_deals,
  coalesce(sum(d.deal_value) filter (where d.status = 'Won'), 0)::numeric as won_value,
  coalesce(sum(d.commission) filter (where d.status = 'Won'), 0)::numeric as won_commission
from public.deals d
left join public.profiles p on p.id = d.sales_person
group by d.sales_person, p.full_name, p.email;

grant select on public.crm_sales_performance to authenticated;

alter function public.reserve_unit_atomic(
  uuid,uuid,numeric,numeric,timestamptz,text
)
security definer
set search_path = pg_catalog,public,private;

alter function public.release_reservation_atomic(uuid,text)
security definer
set search_path = pg_catalog,public,private;

revoke execute on function public.create_opportunity(uuid,uuid,uuid,numeric,numeric,date,text,text) from public;
revoke execute on function public.advance_opportunity_stage(uuid,text,text,text,text) from public;
revoke execute on function public.confirm_reservation_as_deal(uuid,numeric,numeric,integer,text,date,numeric,text) from public;
revoke execute on function public.generate_deal_payment_schedule(uuid,date) from public;
revoke execute on function public.record_deal_payment(uuid,timestamptz,text) from public;

grant execute on function public.create_opportunity(uuid,uuid,uuid,numeric,numeric,date,text,text) to authenticated;
grant execute on function public.advance_opportunity_stage(uuid,text,text,text,text) to authenticated;
grant execute on function public.confirm_reservation_as_deal(uuid,numeric,numeric,integer,text,date,numeric,text) to authenticated;
grant execute on function public.generate_deal_payment_schedule(uuid,date) to authenticated;
grant execute on function public.record_deal_payment(uuid,timestamptz,text) to authenticated;
