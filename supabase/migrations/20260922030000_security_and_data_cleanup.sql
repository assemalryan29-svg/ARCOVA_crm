-- ARCOVA CRM: security alignment and initial data hygiene cleanup.
-- Applied to production before recording this migration.

-- Permanent deletion of leads is Admin-only.
drop policy if exists leads_delete_scoped on public.leads;

create policy leads_delete_scoped
on public.leads
for delete
to authenticated
using (
  (select private.has_permission('leads.delete'::text))
  and (select private."current_role"()) = 'admin'::text
);

-- Backfill normalized lead identity fields without changing source values.
update public.leads
set phone_normalized = nullif(regexp_replace(coalesce(phone,''),'[^0-9]+','','g'),''),
    email_normalized = nullif(lower(btrim(coalesce(email,''))),'')
where phone_normalized is distinct from nullif(regexp_replace(coalesce(phone,''),'[^0-9]+','','g'),'')
   or email_normalized is distinct from nullif(lower(btrim(coalesce(email,''))),'') ;

-- Remove the known integration test lead and its test-only activity.
delete from public.lead_logs
where lead_id = '7591a84e-93dd-4871-995a-7a9fe3b6e1e1';

delete from public.leads
where id = '7591a84e-93dd-4871-995a-7a9fe3b6e1e1'
  and lead_source = 'Hoppscotch Test';
