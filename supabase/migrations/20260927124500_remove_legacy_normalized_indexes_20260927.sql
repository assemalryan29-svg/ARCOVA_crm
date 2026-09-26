-- The normalized lead columns are authoritative; these legacy functional indexes
-- duplicate equivalent lookups. The task user_id single-column index is also
-- covered by (user_id, due_date).
DROP INDEX IF EXISTS public.idx_leads_email_normalized;
DROP INDEX IF EXISTS public.idx_leads_phone_lookup;
DROP INDEX IF EXISTS public.idx_tasks_user_id;
