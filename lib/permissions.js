/**
 * ARCOVA CRM - Centralized role and permission policy.
 * Database/RLS remains the final authorization layer.
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  CEO: 'ceo',
  MANAGER: 'manager',
  TEAM_LEADER: 'team_leader',
  SALES: 'sales',
  FINANCE: 'finance',
  MARKETING: 'marketing',
  OPERATIONS: 'operations',
  SUPPORT: 'support',
});

export const ROLE_LABELS = Object.freeze({
  admin: 'مدير النظام',
  ceo: 'الرئيس التنفيذي',
  manager: 'مدير المبيعات',
  team_leader: 'قائد فريق',
  sales: 'Sales',
  finance: 'المالية',
  marketing: 'التسويق',
  operations: 'العمليات',
  support: 'الدعم',
});

export const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: 'dashboard.view',
  LEADS_VIEW: 'leads.view',
  LEADS_CREATE: 'leads.create',
  LEADS_UPDATE: 'leads.update',
  LEADS_DELETE: 'leads.delete',
  LEADS_IMPORT: 'leads.import',
  LEADS_EXPORT: 'leads.export',
  PIPELINE_VIEW: 'pipeline.view',
  PIPELINE_MANAGE: 'pipeline.manage',
  FOLLOWUPS_VIEW: 'followups.view',
  FOLLOWUPS_MANAGE: 'followups.manage',
  CALLS_VIEW: 'calls.view',
  CALLS_MANAGE: 'calls.manage',
  APPOINTMENTS_VIEW: 'appointments.view',
  APPOINTMENTS_MANAGE: 'appointments.manage',
  PROJECTS_VIEW: 'projects.view',
  PROJECTS_MANAGE: 'projects.manage',
  UNITS_VIEW: 'units.view',
  UNITS_MANAGE: 'units.manage',
  TASKS_VIEW: 'tasks.view',
  TASKS_MANAGE: 'tasks.manage',
  CAMPAIGNS_VIEW: 'campaigns.view',
  CAMPAIGNS_MANAGE: 'campaigns.manage',
  DEALS_VIEW: 'deals.view',
  DEALS_MANAGE: 'deals.manage',
  RESERVATIONS_VIEW: 'reservations.view',
  RESERVATIONS_MANAGE: 'reservations.manage',
  FINANCE_VIEW: 'finance.view',
  FINANCE_MANAGE: 'finance.manage',
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  TEAMS_VIEW: 'teams.view',
  TEAMS_MANAGE: 'teams.manage',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  AUDIT_VIEW: 'audit.view',
});

const ROLE_ALIASES = Object.freeze({
  Admin: ROLES.ADMIN, Manager: ROLES.MANAGER, Sales: ROLES.SALES, CEO: ROLES.CEO,
  Finance: ROLES.FINANCE, 'Team Leader': ROLES.TEAM_LEADER, Marketing: ROLES.MARKETING,
  Operations: ROLES.OPERATIONS, Support: ROLES.SUPPORT,
  admin: ROLES.ADMIN, manager: ROLES.MANAGER, sales: ROLES.SALES, ceo: ROLES.CEO,
  finance: ROLES.FINANCE, team_leader: ROLES.TEAM_LEADER, marketing: ROLES.MARKETING,
  operations: ROLES.OPERATIONS, support: ROLES.SUPPORT,
});

const ALL = new Set(Object.values(PERMISSIONS));
const ROLE_PERMISSIONS = {
  admin: ALL,
  ceo: ALL,
  manager: new Set([
    'dashboard.view','leads.view','leads.create','leads.update','leads.delete','leads.import','leads.export',
    'pipeline.view','pipeline.manage','followups.view','followups.manage','calls.view','calls.manage','appointments.view','appointments.manage',
    'projects.view','projects.manage','units.view','units.manage','tasks.view','tasks.manage','campaigns.view','campaigns.manage',
    'deals.view','deals.manage','reservations.view','reservations.manage','finance.view','reports.view','reports.export',
    'teams.view','teams.manage','users.view','audit.view'
  ]),
  team_leader: new Set([
    'dashboard.view','leads.view','leads.create','leads.update','pipeline.view','pipeline.manage','followups.view','followups.manage',
    'calls.view','calls.manage','appointments.view','appointments.manage','projects.view','units.view','tasks.view','tasks.manage',
    'deals.view','deals.manage','reservations.view','reservations.manage','reports.view','teams.view'
  ]),
  sales: new Set([
    'dashboard.view','leads.view','leads.create','leads.update','leads.export','pipeline.view','pipeline.manage','followups.view','followups.manage',
    'calls.view','calls.manage','appointments.view','appointments.manage','projects.view','units.view','tasks.view','tasks.manage',
    'deals.view','deals.manage','reservations.view','reservations.manage','reports.view'
  ]),
  finance: new Set(['dashboard.view','deals.view','reservations.view','finance.view','finance.manage','reports.view','reports.export','audit.view']),
  marketing: new Set(['dashboard.view','leads.view','leads.create','leads.update','leads.import','leads.export','campaigns.view','campaigns.manage','projects.view','units.view','reports.view']),
  operations: new Set(['dashboard.view','leads.view','pipeline.view','followups.view','calls.view','appointments.view','projects.view','units.view','tasks.view','deals.view','reservations.view','finance.view','reports.view']),
  support: new Set(['dashboard.view','leads.view','followups.view','calls.view','appointments.view','tasks.view','reports.view'])
};

export function normalizeRole(role) {
  if (!role) return null;
  return ROLE_ALIASES[role] || String(role).trim().toLowerCase();
}
export function can(role, permission) {
  return ROLE_PERMISSIONS[normalizeRole(role)]?.has(permission) || false;
}
export function getRoleLabel(role) {
  const normalized = normalizeRole(role);
  return ROLE_LABELS[normalized] || normalized;
}
export function canViewAllLeads(role) {
  return [ROLES.ADMIN, ROLES.CEO, ROLES.MANAGER].includes(normalizeRole(role));
}
export function canManageUsers(role) {
  return [ROLES.ADMIN, ROLES.CEO].includes(normalizeRole(role));
}
export function canManageInventory(role) {
  return [ROLES.ADMIN, ROLES.CEO, ROLES.MANAGER].includes(normalizeRole(role));
}
export function canViewFinancialData(role) {
  return [ROLES.ADMIN, ROLES.CEO, ROLES.FINANCE, ROLES.MANAGER].includes(normalizeRole(role));
}
export function canManageTeam(role) {
  return [ROLES.ADMIN, ROLES.CEO, ROLES.MANAGER, ROLES.TEAM_LEADER].includes(normalizeRole(role));
}
export function getLeadScope(role) {
  const normalized = normalizeRole(role);
  if (!normalized) return 'none';
  if ([ROLES.ADMIN, ROLES.CEO, ROLES.MANAGER].includes(normalized)) return 'all';
  if (normalized === ROLES.TEAM_LEADER) return 'team';
  if (normalized === ROLES.FINANCE) return 'none';
  return 'own';
}
