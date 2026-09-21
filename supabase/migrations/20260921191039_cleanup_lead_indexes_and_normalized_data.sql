-- ARCOVA CRM: cleanup existing lead normalization data and remove an exact duplicate index.
-- Applied to Supabase production on 2026-09-21.

update public.leads
set
  phone_normalized = nullif(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), ''),
  email_normalized = nullif(lower(trim(coalesce(email, ''))), '');

drop index if exists public.idx_leads_created;
