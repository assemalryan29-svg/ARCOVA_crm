-- Reconciled from ARCOVA production schema (migration already applied in Supabase).
-- User-owned/shared saved views with RLS and input normalization.

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null default 'leads',
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_views_module_chk check (module = any (array['leads','projects','pipeline','followups','campaigns']::text[])),
  constraint saved_views_user_module_name_uniq unique (user_id,module,name)
);

create index if not exists idx_saved_views_user_module
  on public.saved_views(user_id,module);

create or replace function private.prepare_saved_view()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  new.name := left(btrim(coalesce(new.name,'')),120);
  if new.name='' then
    raise exception using errcode='22023', message='Saved view name is required.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_prepare_saved_view on public.saved_views;
create trigger trg_prepare_saved_view
before insert or update on public.saved_views
for each row execute function private.prepare_saved_view();

alter table public.saved_views enable row level security;

drop policy if exists saved_views_select_scoped on public.saved_views;
create policy saved_views_select_scoped
on public.saved_views for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    is_shared = true
    and (select private.has_permission('views.view'))
  )
);

drop policy if exists saved_views_insert_scoped on public.saved_views;
create policy saved_views_insert_scoped
on public.saved_views for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.has_permission('views.manage'))
);

drop policy if exists saved_views_update_scoped on public.saved_views;
create policy saved_views_update_scoped
on public.saved_views for update to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_permission('views.manage'))
)
with check (
  user_id = (select auth.uid())
  and (select private.has_permission('views.manage'))
);

drop policy if exists saved_views_delete_scoped on public.saved_views;
create policy saved_views_delete_scoped
on public.saved_views for delete to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_permission('views.manage'))
);
