-- RECOVERED MIGRATION FILE
-- Reconstructed from the live production trigger/function contract.
-- This is a functional reconstruction of the recorded production migration.

create or replace function public.set_task_owner()
returns trigger
language plpgsql
security definer
as $function$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_set_task_owner on public.tasks;
create trigger trg_set_task_owner
before insert on public.tasks
for each row
execute function public.set_task_owner();
