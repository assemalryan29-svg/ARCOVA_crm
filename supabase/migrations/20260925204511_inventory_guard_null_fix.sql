-- Reconciled from ARCOVA production schema (migration already applied in Supabase).
-- Normalizes unit title/unit_number so required fields are protected from null/blank input.

create or replace function public.arcova_prepare_unit()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  if new.title is null or btrim(new.title) = '' then
    new.title := coalesce(new.unit_number, 'وحدة بدون اسم');
  end if;

  if new.unit_number is null or btrim(new.unit_number) = '' then
    new.unit_number := new.title;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_arcova_prepare_unit on public.units;
create trigger trg_arcova_prepare_unit
before insert or update on public.units
for each row execute function public.arcova_prepare_unit();
