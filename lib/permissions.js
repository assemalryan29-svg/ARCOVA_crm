/**
 * ARCOVA CRM - Centralized permission policy
 *
 * Keep authorization decisions in one place so UI checks can later be
 * replaced/paired with Supabase RLS policies without duplicating role logic.
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  CEO: 'ceo',
  FINANCE: 'finance',
  MANAGER: 'manager',
  TEAM_LEADER: 'team_leader',
  SALES: 'sales',
  MARKETING: 'marketing',
});

const ROLE_ALIASES = Object.freeze({
  Admin: ROLES.ADMIN,
  Manager: ROLES.MANAGER,
  Sales: ROLES.SALES,
  CEO: ROLES.CEO,
  Finance: ROLES.FINANCE,
  'Team Leader': ROLES.TEAM_LEADER,
  Marketing: ROLES.MARKETING,
  admin: ROLES.ADMIN,
  manager: ROLES.MANAGER,
  sales: ROLES.SALES,
  ceo: ROLES.CEO,
  finance: ROLES.FINANCE,
  team_leader: ROLES.TEAM_LEADER,
  marketing: ROLES.MARKETING,
});

export function normalizeRole(role) {
  if (!role) return ROLES.SALES;
  return ROLE_ALIASES[role] || String(role).trim().toLowerCase();
}

export function canViewAllLeads(role) {
  return [ROLES.ADMIN, ROLES.CEO, ROLES.MANAGER, ROLES.FINANCE].includes(normalizeRole(role));
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
  const normalizedRole = normalizeRole(role);

  if (canViewAllLeads(normalizedRole)) return 'all';
  if (normalizedRole === ROLES.TEAM_LEADER) return 'team';
  return 'own';
}
