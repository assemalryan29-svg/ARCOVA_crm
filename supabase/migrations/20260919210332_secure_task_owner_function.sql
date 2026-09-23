-- RECOVERED MIGRATION FILE
-- Reconstructed from the hardened live set_task_owner() definition.

create or replace function public.set_task_owner()
returns trigger
language plpgsql
security definer
set search_path to ''
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
