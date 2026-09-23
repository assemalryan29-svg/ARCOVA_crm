-- RECOVERED MIGRATION FILE
-- Functional reconstruction from the live authorization catalog.
-- Restores role/permission tables, seed data, and private authorization helpers.

create schema if not exists private;

create table if not exists public.app_roles (
  key text primary key,
  name_ar text not null,
  name_en text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.app_permissions (
  key text primary key,
  module text not null,
  action text not null,
  name_ar text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_role_permissions (
  role_key text not null references public.app_roles(key) on delete cascade,
  permission_key text not null references public.app_permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

insert into public.app_roles(key,name_ar,name_en,description,is_system) values ('admin','مدير النظام','Admin','صلاحيات النظام الكاملة','t') on conflict (key) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,description=excluded.description,is_system=excluded.is_system;
insert into public.app_roles(key,name_ar,name_en,description,is_system) values ('ceo','الرئيس التنفيذي','CEO','رؤية وتشغيل كامل للنظام','t') on conflict (key) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,description=excluded.description,is_system=excluded.is_system;
insert into public.app_roles(key,name_ar,name_en,description,is_system) values ('finance','المالية','Finance','البيانات والعمليات المالية','t') on conflict (key) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,description=excluded.description,is_system=excluded.is_system;
insert into public.app_roles(key,name_ar,name_en,description,is_system) values ('manager','مدير المبيعات','Manager','إدارة المبيعات والفرق والعملاء','t') on conflict (key) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,description=excluded.description,is_system=excluded.is_system;
insert into public.app_roles(key,name_ar,name_en,description,is_system) values ('marketing','التسويق','Marketing','الحملات ومصادر العملاء','t') on conflict (key) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,description=excluded.description,is_system=excluded.is_system;
insert into public.app_roles(key,name_ar,name_en,description,is_system) values ('operations','العمليات','Operations','التشغيل الداخلي','t') on conflict (key) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,description=excluded.description,is_system=excluded.is_system;
insert into public.app_roles(key,name_ar,name_en,description,is_system) values ('sales','Sales','Sales','إدارة العملاء والصفقات الخاصة به','t') on conflict (key) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,description=excluded.description,is_system=excluded.is_system;
insert into public.app_roles(key,name_ar,name_en,description,is_system) values ('support','الدعم','Support','الدعم والمتابعة','t') on conflict (key) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,description=excluded.description,is_system=excluded.is_system;
insert into public.app_roles(key,name_ar,name_en,description,is_system) values ('team_leader','قائد فريق','Team Leader','إدارة فريقه وعملائه ومتابعاته','t') on conflict (key) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,description=excluded.description,is_system=excluded.is_system;

insert into public.app_permissions(key,module,action,name_ar,description) values ('appointments.manage','appointments','manage','إدارة المواعيد','إنشاء وتعديل المواعيد') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('appointments.view','appointments','view','عرض المواعيد','عرض المواعيد') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('audit.view','audit','view','سجل التدقيق','عرض سجل التدقيق') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('calls.manage','calls','manage','إدارة المكالمات','تسجيل وإدارة المكالمات') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('calls.view','calls','view','عرض المكالمات','عرض سجل المكالمات') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('campaigns.manage','campaigns','manage','إدارة الحملات','إدارة الحملات التسويقية') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('campaigns.view','campaigns','view','عرض الحملات','عرض الحملات') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('dashboard.view','dashboard','view','عرض لوحة التحكم','عرض مؤشرات ولوحة التحكم') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('deals.manage','deals','manage','إدارة الصفقات','إنشاء وتحديث الصفقات') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('deals.view','deals','view','عرض الصفقات','عرض الصفقات') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('finance.manage','finance','manage','إدارة المالية','إدارة الدفعات والبيانات المالية') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('finance.view','finance','view','عرض المالية','عرض البيانات المالية') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('followups.manage','followups','manage','إدارة المتابعات','إنشاء وتعديل وإتمام المتابعات') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('followups.view','followups','view','عرض المتابعات','عرض المتابعات وفق النطاق') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('leads.create','leads','create','إضافة عميل','إنشاء عميل جديد') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('leads.delete','leads','delete','حذف عميل','حذف العملاء') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('leads.export','leads','export','تصدير العملاء','تصدير بيانات العملاء') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('leads.import','leads','import','استيراد العملاء','استيراد العملاء من CSV') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('leads.update','leads','update','تعديل عميل','تعديل بيانات العميل') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('leads.view','leads','view','عرض العملاء','عرض بيانات العملاء وفق النطاق') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('pipeline.view','pipeline','view','عرض الـPipeline','عرض مراحل العملاء') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('projects.manage','projects','manage','إدارة المشاريع','إنشاء وتعديل وحذف المشاريع') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('projects.view','projects','view','عرض المشاريع','عرض المشاريع') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('reports.export','reports','export','تصدير التقارير','تصدير التقارير') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('reports.view','reports','view','عرض التقارير','عرض تقارير الأداء') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('reservations.manage','reservations','manage','إدارة الحجوزات','إدارة الحجوزات') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('reservations.view','reservations','view','عرض الحجوزات','عرض الحجوزات') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('roles.manage','roles','manage','إدارة الصلاحيات','تعديل ربط الأدوار بالصلاحيات') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('tasks.manage','tasks','manage','إدارة المهام','إنشاء وتحديث المهام') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('tasks.view','tasks','view','عرض المهام','عرض المهام') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('teams.manage','teams','manage','إدارة الفرق','إنشاء وتعديل هيكل الفرق') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('teams.view','teams','view','عرض الفرق','عرض الهيكل والفرق') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('units.manage','units','manage','إدارة الوحدات','إدارة المخزون والوحدات') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('units.view','units','view','عرض الوحدات','عرض المخزون والوحدات') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('users.manage','users','manage','إدارة المستخدمين','إنشاء المستخدمين وتعديل أدوارهم') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;
insert into public.app_permissions(key,module,action,name_ar,description) values ('users.view','users','view','عرض المستخدمين','عرض المستخدمين') on conflict (key) do update set module=excluded.module,action=excluded.action,name_ar=excluded.name_ar,description=excluded.description;

insert into public.app_role_permissions(role_key,permission_key) values ('admin','appointments.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','appointments.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','audit.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','calls.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','calls.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','campaigns.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','campaigns.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','dashboard.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','deals.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','deals.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','finance.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','finance.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','followups.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','followups.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','leads.create') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','leads.delete') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','leads.export') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','leads.import') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','leads.update') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','leads.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','pipeline.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','projects.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','projects.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','reports.export') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','reports.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','reservations.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','reservations.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','roles.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','tasks.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','tasks.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','teams.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','teams.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','units.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','units.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','users.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('admin','users.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','appointments.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','appointments.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','audit.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','calls.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','calls.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','campaigns.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','campaigns.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','dashboard.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','deals.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','deals.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','finance.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','finance.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','followups.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','followups.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','leads.create') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','leads.delete') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','leads.export') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','leads.import') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','leads.update') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','leads.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','pipeline.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','projects.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','projects.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','reports.export') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','reports.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','reservations.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','reservations.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','roles.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','tasks.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','tasks.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','teams.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','teams.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','units.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','units.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','users.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('ceo','users.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('finance','audit.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('finance','dashboard.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('finance','deals.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('finance','finance.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('finance','finance.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('finance','reports.export') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('finance','reports.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('finance','reservations.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','appointments.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','appointments.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','audit.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','calls.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','calls.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','campaigns.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','campaigns.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','dashboard.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','deals.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','deals.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','finance.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','followups.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','followups.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','leads.create') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','leads.delete') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','leads.export') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','leads.import') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','leads.update') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','leads.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','pipeline.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','projects.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','projects.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','reports.export') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','reports.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','reservations.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','reservations.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','tasks.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','tasks.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','teams.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','teams.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','units.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','units.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('manager','users.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('marketing','campaigns.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('marketing','campaigns.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('marketing','dashboard.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('marketing','leads.create') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('marketing','leads.export') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('marketing','leads.import') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('marketing','leads.update') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('marketing','leads.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('marketing','projects.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('marketing','reports.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('marketing','units.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','appointments.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','calls.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','dashboard.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','deals.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','finance.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','followups.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','leads.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','pipeline.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','projects.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','reports.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','reservations.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','tasks.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('operations','units.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','appointments.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','appointments.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','calls.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','calls.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','dashboard.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','deals.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','deals.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','followups.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','followups.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','leads.create') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','leads.export') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','leads.update') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','leads.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','pipeline.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','projects.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','reports.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','reservations.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','reservations.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','tasks.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','tasks.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('sales','units.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('support','appointments.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('support','calls.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('support','dashboard.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('support','followups.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('support','leads.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('support','reports.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('support','tasks.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','appointments.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','appointments.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','calls.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','calls.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','dashboard.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','deals.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','deals.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','followups.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','followups.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','leads.create') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','leads.update') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','leads.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','pipeline.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','projects.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','reports.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','reservations.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','reservations.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','tasks.manage') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','tasks.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','teams.view') on conflict do nothing;
insert into public.app_role_permissions(role_key,permission_key) values ('team_leader','units.view') on conflict do nothing;

CREATE OR REPLACE FUNCTION private."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select lower(coalesce(ur.role, 'sales'))
  from public.user_roles ur
  where ur.id = (select auth.uid()) and coalesce(ur.active,true)
  limit 1
$function$


CREATE OR REPLACE FUNCTION private.has_permission(p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.user_roles ur
    join public.app_role_permissions arp on arp.role_key = lower(ur.role)
    where ur.id = (select auth.uid())
      and coalesce(ur.active,true)
      and arp.permission_key = p_permission
  )
$function$


CREATE OR REPLACE FUNCTION private.can_access_user(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and (
      p_user_id = (select auth.uid())
      or (select private.current_role()) in ('admin','ceo','manager')
      or (
        (select private.current_role()) = 'team_leader'
        and exists (
          select 1 from public.profiles p
          where p.id = p_user_id and (p.team_leader_id = (select auth.uid()) or p.team_id = (
            select pr.team_id from public.profiles pr where pr.id = (select auth.uid())
          ))
        )
      )
    )
$function$


CREATE OR REPLACE FUNCTION private.can_access_lead(p_assigned_to uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select auth.uid()) is not null
    and (
      (select private.current_role()) in ('admin','ceo','manager')
      or p_assigned_to = (select auth.uid())
      or (
        (select private.current_role()) = 'team_leader'
        and exists (
          select 1
          from public.profiles p
          where p.id = p_assigned_to
            and (p.team_leader_id = (select auth.uid()) or p.team_id = (
              select pr.team_id from public.profiles pr where pr.id = (select auth.uid())
            ))
        )
      )
      or (
        (select private.current_role()) = 'marketing'
        and exists (
          select 1 from public.leads l
          where l.assigned_to = p_assigned_to
            and (l.assigned_to = (select auth.uid()) or l.lead_source = 'Marketing')
        )
      )
    )
$function$


revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke all on function private.current_role() from public, anon;
revoke all on function private.has_permission(text) from public, anon;
revoke all on function private.can_access_user(uuid) from public, anon;
revoke all on function private.can_access_lead(uuid) from public, anon;

grant execute on function private.current_role() to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.can_access_user(uuid) to authenticated;
grant execute on function private.can_access_lead(uuid) to authenticated;
