-- RECOVERED MIGRATION FILE
-- The exact pre-hardening inventory policy expressions are not recoverable from the live catalog.
-- Recovery semantics: ensure inventory is protected by RLS before the later authorization migrations
-- install the canonical current policies.

alter table if exists public.inventory enable row level security;
