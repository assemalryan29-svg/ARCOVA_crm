-- RECOVERED MIGRATION FILE
-- Functional reconstruction: synchronize normalized identity values with source fields.

update public.leads
set
  phone_normalized = nullif(regexp_replace(coalesce(phone, ''), '[^0-9]+', '', 'g'), ''),
  email_normalized = nullif(lower(btrim(coalesce(email, ''))), '')
where phone_normalized is distinct from nullif(regexp_replace(coalesce(phone, ''), '[^0-9]+', '', 'g'), '')
   or email_normalized is distinct from nullif(lower(btrim(coalesce(email, ''))), '');

create index if not exists leads_phone_normalized_idx
  on public.leads(phone_normalized)
  where phone_normalized is not null;

create index if not exists leads_email_normalized_idx
  on public.leads(email_normalized)
  where email_normalized is not null;
