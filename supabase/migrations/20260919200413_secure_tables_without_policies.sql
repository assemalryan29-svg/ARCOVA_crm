-- RECOVERED MIGRATION FILE
-- Functional reconstruction: ensure every existing public table is RLS-protected.
-- Later authorization migrations install the canonical policy set.

do $$
declare r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname='public'
  loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end $$;
