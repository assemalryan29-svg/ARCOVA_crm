-- RECOVERED MIGRATION FILE
-- Reconstructed from the live duplicate-reporting view definition.
-- security_invoker is applied by the later ingestion-hardening migration.

create or replace view public.lead_duplicate_groups as
select
  coalesce(nullif(phone_normalized, ''), nullif(email_normalized, '')) as identity_key,
  case when phone_normalized is not null then 'phone'::text else 'email'::text end as identity_type,
  count(*)::integer as duplicate_count,
  array_agg(id order by created_at) as lead_ids,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.leads
where phone_normalized is not null or email_normalized is not null
group by
  coalesce(nullif(phone_normalized, ''), nullif(email_normalized, '')),
  case when phone_normalized is not null then 'phone'::text else 'email'::text end
having count(*) > 1;
