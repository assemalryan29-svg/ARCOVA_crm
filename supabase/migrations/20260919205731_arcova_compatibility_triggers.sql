-- RECOVERED MIGRATION FILE
-- Reconstructed from live ARCOVA compatibility functions/triggers.

create or replace function public.arcova_prepare_task()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.user_id is null then
    new.user_id := coalesce(new.created_by, auth.uid());
  end if;
  if new.created_by is null then
    new.created_by := coalesce(new.user_id, auth.uid());
  end if;
  if new.status is null then
    new.status := case when coalesce(new.is_completed,false) then 'Completed' else 'Pending' end;
  end if;
  return new;
end;
$function$;

create or replace function public.arcova_prepare_unit()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.title is null or btrim(new.title) = '' then
    new.title := coalesce(new.unit_number, 'وحدة بدون اسم');
  end if;
  if new.unit_number is null or btrim(new.unit_number) = '' then
    new.unit_number := new.title;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_arcova_prepare_task on public.tasks;
create trigger trg_arcova_prepare_task
before insert or update on public.tasks
for each row
execute function public.arcova_prepare_task();

drop trigger if exists trg_arcova_prepare_unit on public.units;
create trigger trg_arcova_prepare_unit
before insert or update on public.units
for each row
execute function public.arcova_prepare_unit();
