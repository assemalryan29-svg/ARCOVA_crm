-- ARCOVA CRM: enable realtime delivery for leads created by external integrations.
-- RLS remains the authorization boundary; the dashboard re-queries leads after each event.
alter publication supabase_realtime add table public.leads;
