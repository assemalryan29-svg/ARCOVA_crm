-- ARCOVA CRM
-- Follow-up fix: NULL session setting must not bypass the unit status guard.

create or replace function private.guard_unit_status_transition()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_transition text := coalesce(current_setting('arcova.unit_transition', true),'');
begin
  if tg_op='INSERT' then
    if new.status is null then new.status := 'Available'; end if;
    if new.status not in ('Available','Reserved','Sold') then
      raise exception using errcode='22023', message='Invalid unit status.';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if v_transition <> 'allowed' then
      raise exception using errcode='42501', message='Unit status can only be changed through the protected inventory workflow.';
    end if;

    if not (
      (old.status='Available' and new.status='Reserved')
      or (old.status='Reserved' and new.status in ('Available','Sold'))
    ) then
      raise exception using errcode='22023', message='Invalid unit status transition.';
    end if;
  end if;

  return new;
end;
$$;