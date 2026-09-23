-- RECOVERED MIGRATION FILE
-- Reconstructed from live function definitions and search_path settings.

create or replace function public.arcova_normalize_phone(value text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select nullif(regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g'), '');
$function$;

create or replace function public.arcova_normalize_email(value text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select nullif(lower(btrim(coalesce(value, ''))), '');
$function$;

create or replace function public.prevent_duplicate_lead()
returns trigger
language plpgsql
set search_path to ''
as $function$
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
    raise exception 'DUPLICATE_LEAD_EMAIL: A lead with this email address already exists.'
      using errcode = '23505';
  end if;

  return new;
end;
$function$;
