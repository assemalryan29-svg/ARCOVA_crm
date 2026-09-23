-- RECOVERED MIGRATION FILE
-- Reconstructed from the live normalization functions/triggers.

create or replace function public.normalize_lead_identity()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.phone_normalized := nullif(regexp_replace(coalesce(new.phone,''),'[^0-9]+','','g'),'');
  new.email_normalized := nullif(lower(btrim(coalesce(new.email,''))),'');
  return new;
end;
$function$;

create or replace function public.prevent_duplicate_lead_identity()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.phone_normalized is not null then
    perform pg_advisory_xact_lock(hashtext('leads:phone:' || new.phone_normalized));
    if exists (
      select 1 from public.leads l
      where l.phone_normalized = new.phone_normalized and l.id <> new.id
    ) then
      raise exception using errcode='23505', message='Duplicate lead phone detected';
    end if;
  end if;

  if new.email_normalized is not null then
    perform pg_advisory_xact_lock(hashtext('leads:email:' || new.email_normalized));
    if exists (
      select 1 from public.leads l
      where l.email_normalized = new.email_normalized and l.id <> new.id
    ) then
      raise exception using errcode='23505', message='Duplicate lead email detected';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_normalize_lead_identity on public.leads;
create trigger trg_normalize_lead_identity
before insert or update of phone, email on public.leads
for each row execute function public.normalize_lead_identity();

drop trigger if exists trg_prevent_duplicate_lead_identity on public.leads;
create trigger trg_prevent_duplicate_lead_identity
before insert or update of phone, email on public.leads
for each row execute function public.prevent_duplicate_lead_identity();
