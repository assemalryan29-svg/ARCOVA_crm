create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  status text not null default 'processed',
  payload_hash text,
  created_at timestamptz not null default now(),
  unique(provider, event_id)
);

alter table public.integration_events enable row level security;

create index if not exists integration_events_provider_event_idx
  on public.integration_events(provider, event_id);

comment on table public.integration_events is
  'Idempotency ledger for external integrations such as Meta Facebook Lead Ads and WhatsApp webhooks.';
