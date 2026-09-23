-- RECOVERED MIGRATION FILE
-- Reconstructed from the live production projects schema.

alter table public.projects
  add column if not exists description text;
