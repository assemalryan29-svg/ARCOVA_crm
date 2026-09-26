ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Completed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calls_status_check'
      AND conrelid = 'public.calls'::regclass
  ) THEN
    ALTER TABLE public.calls
      ADD CONSTRAINT calls_status_check
      CHECK (status = ANY (ARRAY['Completed'::text, 'Cancelled'::text]));
  END IF;
END
$$;

UPDATE public.calls
SET status = 'Completed'
WHERE status IS NULL;

DROP INDEX IF EXISTS public.idx_appointments_lead_id;
DROP INDEX IF EXISTS public.idx_calls_lead_id;
DROP INDEX IF EXISTS public.idx_deals_lead_id;
DROP INDEX IF EXISTS public.idx_reservations_lead_id;
DROP INDEX IF EXISTS public.idx_followups_assigned_to;
DROP INDEX IF EXISTS public.idx_leads_assigned_to;
DROP INDEX IF EXISTS public.tasks_lead_id_idx;

DROP TABLE IF EXISTS public.inventory;
