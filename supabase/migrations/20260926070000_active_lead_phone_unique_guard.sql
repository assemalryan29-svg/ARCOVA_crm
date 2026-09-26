-- Prevent duplicate active leads by normalized phone number.
-- Archived leads remain allowed so historical records are preserved.
create unique index if not exists uq_leads_active_phone_normalized
  on public.leads (phone_normalized)
  where status <> 'Archived'
    and phone_normalized is not null
    and btrim(phone_normalized) <> '';
