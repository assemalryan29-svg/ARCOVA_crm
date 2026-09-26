-- ARCOVA CRM: consolidate Phase 4 backup tables into a private archive snapshot.
-- Historical data is preserved in private.phase4_backup_archive; public backup tables are removed.
-- The runtime phase4 validation function now reads from the consolidated archive.

create schema if not exists private;

create table if not exists private.phase4_backup_archive (
  backup_date date not null,
  entity_type text not null,
  source_table text not null,
  record_key text not null,
  payload jsonb not null,
  archived_at timestamptz not null default now(),
  primary key (backup_date, entity_type, record_key)
);

-- The live migration already copies the 18 original phase4_backup_20260923_* tables
-- into the archive before dropping those public backup tables.
