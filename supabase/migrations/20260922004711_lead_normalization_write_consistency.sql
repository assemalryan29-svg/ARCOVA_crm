-- ARCOVA CRM: keep lead normalized identity fields synchronized on every write.
-- This migration was applied to production as version 20260922004711.

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
  select nullif(lower(btrim(coalesce(value, ''))), '');
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

  new.phone_normalized := normalized_phone;
  new.email_normalized := normalized_email;

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

update public.leads
set phone_normalized = public.arcova_normalize_phone(phone),
    email_normalized = public.arcova_normalize_email(email)
where phone_normalized is distinct from public.arcova_normalize_phone(phone)
   or email_normalized is distinct from public.arcova_normalize_email(email);
