-- RECOVERED MIGRATION FILE
-- Functional reconstruction from the live schema and dashboard field contract.
-- All changes are idempotent and only add compatibility fields that exist in production.

alter table public.leads
  add column if not exists budget numeric,
  add column if not exists unit_type text,
  add column if not exists preferred_area text,
  add column if not exists desired_unit_type text,
  add column if not exists folder text,
  add column if not exists preferred_location text,
  add column if not exists project_id uuid,
  add column if not exists "اسم_الحقل" text;

alter table public.units
  add column if not exists project_id uuid,
  add column if not exists unit_number text,
  add column if not exists area numeric;

alter table public.tasks
  add column if not exists lead_id uuid,
  add column if not exists due_date timestamptz,
  add column if not exists description text,
  add column if not exists status text default 'Pending',
  add column if not exists created_by uuid;
