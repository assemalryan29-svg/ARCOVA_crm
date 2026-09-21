-- ARCOVA CRM: remove redundant leads.created_at index.
-- The live advisor reported idx_leads_created and idx_leads_created_at as identical.
-- Keep idx_leads_created_at and remove the duplicate only.

drop index if exists public.idx_leads_created;
