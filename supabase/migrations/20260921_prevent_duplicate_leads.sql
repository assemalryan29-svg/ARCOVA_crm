-- ARCOVA CRM: global duplicate protection for leads.
-- Run this migration in Supabase SQL Editor.
-- It protects against duplicates even when the lead is outside the current UI page.

create or replace function public.arcova_normalize_phone(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g'), '');
$$;

create or replace function public.arcova_normalize_email(value text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(value, ''))), '');
$$;

create or replace function public.prevent_duplicate_lead()
returns trigger
language plpgsql
security invoker
as $$
 declare
  normalized_phone text;
  normalized_email text;
 begin
  normalized_phone := public.arcova_normalize_phone(new.phone);
  normalized_email := public.arcova_normalize_email(new.email);

  if normalized_phone is not null and exists (
    select 1
    from public.leads existing
    where existing.id is distinct from new.id
      and public.arcova_normalize_phone(existing.phone) = normalized_phone
  ) then
    raise exception 'DUPLICATE_LEAD_PHONE: A lead with this phone number already exists.'
      using errcode = '23505';
  end if;

  if normalized_email is not null and exists (
    select 1
    from public.leads existing
    where existing.id is distinct from new.id
      and public.arcova_normalize_email(existing.email) = normalized_email
  ) then
    raise exception 'DUPLICATE_LEAD_EMAIL: A lead with this email already exists.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_duplicate_lead on public.leads;

create trigger trg_prevent_duplicate_lead
before insert or update of phone, email on public.leads
for each row
execute function public.prevent_duplicate_lead();
