-- ARCOVA hardening: atomic inventory reservation + duplicate review control
-- Applied to production Supabase before this repository migration was committed.

create index if not exists reservations_active_unit_idx
  on public.reservations(unit_id)
  where unit_id is not null and status in ('Pending','Confirmed','Active');

create or replace function public.reserve_unit_atomic(
  p_lead_id uuid,p_unit_id uuid,p_reservation_amount numeric,
  p_contract_value numeric default null,p_expires_at timestamptz default null,p_notes text default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$ ... $$;

create or replace function public.release_reservation_atomic(
  p_reservation_id uuid,p_new_status text default 'Cancelled')
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$ ... $$;
