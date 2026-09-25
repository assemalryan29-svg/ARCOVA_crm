-- ARCOVA CRM
-- Automation engine: data-driven rules, deduplicated executions, lead/opportunity triggers.

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  name_ar text not null,
  description text,
  trigger_event text not null check (trigger_event in ('lead.status','opportunity.stage')),
  conditions jsonb not null default '{}'::jsonb,
  action_type text not null check (action_type in ('create_followup','create_task')),
  action_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  event_key text not null,
  status text not null check (status in ('success','failed','skipped')) default 'success',
  result jsonb not null default '{}'::jsonb,
  executed_at timestamptz not null default now(),
  unique(rule_id,entity_type,entity_id,event_key)
);

create index if not exists automation_rules_event_idx on public.automation_rules(trigger_event,is_active);
create index if not exists automation_runs_entity_idx on public.automation_runs(entity_type,entity_id,executed_at desc);

alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;

drop policy if exists automation_rules_select_scoped on public.automation_rules;
create policy automation_rules_select_scoped
on public.automation_rules for select to authenticated
using ((select private.has_permission('automation.view')));

drop policy if exists automation_rules_manage_scoped on public.automation_rules;
create policy automation_rules_manage_scoped
on public.automation_rules for all to authenticated
using ((select private.has_permission('automation.manage')))
with check ((select private.has_permission('automation.manage')));

drop policy if exists automation_runs_select_scoped on public.automation_runs;
create policy automation_runs_select_scoped
on public.automation_runs for select to authenticated
using ((select private.has_permission('automation.view')));

insert into public.app_permissions(key,module,action,name_ar,description)
select 'automation.view','automation','view','عرض الأتمتة','عرض قواعد التشغيل التلقائي وسجل التنفيذ'
where not exists(select 1 from public.app_permissions where key='automation.view');

insert into public.app_permissions(key,module,action,name_ar,description)
select 'automation.manage','automation','manage','إدارة الأتمتة','إنشاء وتفعيل وتعطيل قواعد التشغيل التلقائي'
where not exists(select 1 from public.app_permissions where key='automation.manage');

insert into public.app_role_permissions(role_key,permission_key)
select r.role_key,'automation.view'
from (values ('admin'),('ceo'),('manager'),('team_leader')) r(role_key)
where not exists(
  select 1 from public.app_role_permissions arp
  where arp.role_key=r.role_key and arp.permission_key='automation.view'
);

insert into public.app_role_permissions(role_key,permission_key)
select r.role_key,'automation.manage'
from (values ('admin'),('ceo'),('manager')) r(role_key)
where not exists(
  select 1 from public.app_role_permissions arp
  where arp.role_key=r.role_key and arp.permission_key='automation.manage'
);

insert into public.automation_rules(rule_key,name_ar,description,trigger_event,conditions,action_type,action_config)
values
('lead.contact.created_followup','متابعة بعد الاتصال','إنشاء متابعة تلقائية بعد تحويل العميل إلى تم الاتصال.','lead.status',
  jsonb_build_object('status','Contacted'),'create_followup',
  jsonb_build_object('days',1,'type','Call','notes','متابعة تلقائية بعد أول اتصال')),
('opportunity.site_visit.created_followup','متابعة بعد المعاينة','إنشاء متابعة تلقائية بعد انتقال الفرصة إلى مرحلة المعاينة.','opportunity.stage',
  jsonb_build_object('stage','Site Visit'),'create_followup',
  jsonb_build_object('days',1,'type','Meeting','notes','متابعة تلقائية بعد المعاينة')),
('opportunity.negotiation.created_followup','متابعة التفاوض','إنشاء متابعة تلقائية للفرصة أثناء التفاوض.','opportunity.stage',
  jsonb_build_object('stage','Negotiation'),'create_followup',
  jsonb_build_object('days',1,'type','Call','notes','متابعة تلقائية لمرحلة التفاوض')),
('opportunity.reserved.contract_task','مهمة بعد الحجز','إنشاء مهمة داخلية لتجهيز إجراءات التعاقد بعد الحجز.','opportunity.stage',
  jsonb_build_object('stage','Reserved'),'create_task',
  jsonb_build_object('days',1,'title','تجهيز مستندات التعاقد','description','مراجعة بيانات الحجز وتجهيز خطوات التعاقد'))
on conflict(rule_key) do update set
  name_ar=excluded.name_ar,
  description=excluded.description,
  trigger_event=excluded.trigger_event,
  conditions=excluded.conditions,
  action_type=excluded.action_type,
  action_config=excluded.action_config,
  updated_at=now();

create or replace function private.apply_automation()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  r public.automation_rules%rowtype;
  v_run_id uuid;
  v_event_key text;
  v_days integer;
  v_followup_type text;
  v_notes text;
  v_title text;
  v_description text;
begin
  if tg_table_name='leads' then
    if tg_op='UPDATE' and not (old.status is distinct from new.status) then return new; end if;

    for r in
      select * from public.automation_rules
      where is_active=true
        and trigger_event='lead.status'
        and conditions->>'status'=new.status
    loop
      v_event_key := 'status:'||coalesce(new.status,'');
      insert into public.automation_runs(rule_id,entity_type,entity_id,event_key,status)
      values(r.id,'lead',new.id,v_event_key,'success')
      on conflict(rule_id,entity_type,entity_id,event_key) do nothing
      returning id into v_run_id;

      if v_run_id is null then continue; end if;

      begin
        if r.action_type='create_followup' and new.assigned_to is not null then
          v_days := greatest(coalesce((r.action_config->>'days')::int,1),0);
          v_followup_type := coalesce(r.action_config->>'type','Call');
          v_notes := r.action_config->>'notes';
          insert into public.followups(lead_id,assigned_to,followup_date,type,status,notes)
          values(new.id,new.assigned_to,now()+make_interval(days=>v_days),v_followup_type,'Pending',v_notes);
        elsif r.action_type='create_task' and new.assigned_to is not null then
          v_days := greatest(coalesce((r.action_config->>'days')::int,1),0);
          v_title := coalesce(r.action_config->>'title','متابعة تلقائية');
          v_description := r.action_config->>'description';
          insert into public.tasks(user_id,title,is_completed,created_at,lead_id,due_date,description,status,created_by)
          values(new.assigned_to,v_title,false,now(),new.id,now()+make_interval(days=>v_days),v_description,'Pending',auth.uid());
        end if;
        update public.automation_runs set result=jsonb_build_object('ok',true,'action',r.action_type) where id=v_run_id;
      exception when others then
        update public.automation_runs
        set status='failed',result=jsonb_build_object('ok',false,'error',sqlerrm)
        where id=v_run_id;
      end;
    end loop;

  elsif tg_table_name='opportunities' then
    if tg_op='UPDATE' and not (old.stage is distinct from new.stage) then return new; end if;

    for r in
      select * from public.automation_rules
      where is_active=true
        and trigger_event='opportunity.stage'
        and conditions->>'stage'=new.stage
    loop
      v_event_key := 'stage:'||coalesce(new.stage,'');
      insert into public.automation_runs(rule_id,entity_type,entity_id,event_key,status)
      values(r.id,'opportunity',new.id,v_event_key,'success')
      on conflict(rule_id,entity_type,entity_id,event_key) do nothing
      returning id into v_run_id;

      if v_run_id is null then continue; end if;

      begin
        if r.action_type='create_followup' and new.assigned_to is not null then
          v_days := greatest(coalesce((r.action_config->>'days')::int,1),0);
          v_followup_type := coalesce(r.action_config->>'type','Call');
          v_notes := r.action_config->>'notes';
          insert into public.followups(lead_id,assigned_to,followup_date,type,status,notes)
          values(new.lead_id,new.assigned_to,now()+make_interval(days=>v_days),v_followup_type,'Pending',v_notes);
        elsif r.action_type='create_task' and new.assigned_to is not null then
          v_days := greatest(coalesce((r.action_config->>'days')::int,1),0);
          v_title := coalesce(r.action_config->>'title','إجراء تلقائي');
          v_description := r.action_config->>'description';
          insert into public.tasks(user_id,title,is_completed,created_at,lead_id,due_date,description,status,created_by)
          values(new.assigned_to,v_title,false,now(),new.lead_id,now()+make_interval(days=>v_days),v_description,'Pending',auth.uid());
        end if;
        update public.automation_runs set result=jsonb_build_object('ok',true,'action',r.action_type) where id=v_run_id;
      exception when others then
        update public.automation_runs
        set status='failed',result=jsonb_build_object('ok',false,'error',sqlerrm)
        where id=v_run_id;
      end;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_automation_leads on public.leads;
create trigger trg_automation_leads
after insert or update of status on public.leads
for each row execute function private.apply_automation();

drop trigger if exists trg_automation_opportunities on public.opportunities;
create trigger trg_automation_opportunities
after insert or update of stage on public.opportunities
for each row execute function private.apply_automation();

revoke execute on function private.apply_automation() from public,anon,authenticated;
