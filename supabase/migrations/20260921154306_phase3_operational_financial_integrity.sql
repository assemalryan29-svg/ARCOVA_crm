-- RECOVERED MIGRATION FILE
-- Functional reconstruction from the live operational/financial schema.
-- Tables are assumed to pre-exist; this migration restores columns, constraints, and indexes
-- that are present in production.

alter table public.deals
  add column if not exists reservation_id uuid,
  add column if not exists down_payment numeric,
  add column if not exists installment_months integer,
  add column if not exists payment_frequency text,
  add column if not exists contract_date date,
  add column if not exists notes text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='deals_deal_value_nonnegative' and conrelid='public.deals'::regclass) then
    alter table public.deals add constraint deals_deal_value_nonnegative check (deal_value is null or deal_value >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='deals_commission_nonnegative' and conrelid='public.deals'::regclass) then
    alter table public.deals add constraint deals_commission_nonnegative check (commission is null or commission >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='deals_down_payment_nonnegative' and conrelid='public.deals'::regclass) then
    alter table public.deals add constraint deals_down_payment_nonnegative check (down_payment is null or down_payment >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='deals_installment_months_positive' and conrelid='public.deals'::regclass) then
    alter table public.deals add constraint deals_installment_months_positive check (installment_months is null or installment_months > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='reservations_amounts_nonnegative' and conrelid='public.reservations'::regclass) then
    alter table public.reservations add constraint reservations_amounts_nonnegative check (reservation_amount >= 0 and (contract_value is null or contract_value >= 0));
  end if;
  if not exists (select 1 from pg_constraint where conname='deal_payments_amount_check' and conrelid='public.deal_payments'::regclass) then
    alter table public.deal_payments add constraint deal_payments_amount_check check (amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='deal_payments_installment_no_positive' and conrelid='public.deal_payments'::regclass) then
    alter table public.deal_payments add constraint deal_payments_installment_no_positive check (installment_no > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='deal_payments_deal_id_installment_no_key' and conrelid='public.deal_payments'::regclass) then
    alter table public.deal_payments add constraint deal_payments_deal_id_installment_no_key unique (deal_id, installment_no);
  end if;
end $$;

create index if not exists idx_deals_lead_id on public.deals(lead_id);
create index if not exists idx_deals_unit_id on public.deals(unit_id);
create index if not exists idx_deals_sales_person on public.deals(sales_person);
create index if not exists idx_deals_reservation_id on public.deals(reservation_id);
create index if not exists idx_reservations_lead_id on public.reservations(lead_id);
create index if not exists idx_reservations_unit_id on public.reservations(unit_id);
create index if not exists idx_reservations_sales_person on public.reservations(sales_person);
create index if not exists idx_deal_payments_due_date on public.deal_payments(due_date, status);
create index if not exists idx_calls_lead_id on public.calls(lead_id);
create index if not exists idx_calls_assigned_at on public.calls(assigned_to, call_at desc);
create index if not exists idx_followups_lead_id on public.followups(lead_id);
create index if not exists idx_followups_assigned_date on public.followups(assigned_to, followup_date);
create index if not exists idx_apps_lead_id on public.appointments(lead_id);
create index if not exists idx_appointments_assigned_at on public.appointments(assigned_to, scheduled_at);
