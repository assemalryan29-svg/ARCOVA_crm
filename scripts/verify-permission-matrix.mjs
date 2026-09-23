import { ROLES, PERMISSIONS, normalizeRole, can, getLeadScope } from '../lib/permissions.js';

const checks = [
  [ROLES.ADMIN, PERMISSIONS.USERS_MANAGE, true],
  [ROLES.CEO, PERMISSIONS.USERS_MANAGE, true],
  [ROLES.MANAGER, PERMISSIONS.LEADS_IMPORT, true],
  [ROLES.TEAM_LEADER, PERMISSIONS.LEADS_IMPORT, false],
  [ROLES.SALES, PERMISSIONS.LEADS_DELETE, false],
  [ROLES.FINANCE, PERMISSIONS.LEADS_VIEW, false],
  [ROLES.FINANCE, PERMISSIONS.FINANCE_MANAGE, true],
  [ROLES.MARKETING, PERMISSIONS.CAMPAIGNS_MANAGE, true],
];

for (const [role, permission, expected] of checks) {
  const actual = can(role, permission);
  if (actual !== expected) {
    throw new Error(`Permission mismatch: ${role} / ${permission}: expected ${expected}, got ${actual}`);
  }
}

if (normalizeRole(null) !== null) throw new Error('Missing role must not default to sales.');
if (getLeadScope(null) !== 'none') throw new Error('Missing role must fail closed for lead scope.');
if (getLeadScope(ROLES.SALES) !== 'own') throw new Error('Sales lead scope must be own.');
if (getLeadScope(ROLES.TEAM_LEADER) !== 'team') throw new Error('Team leader lead scope must be team.');
if (getLeadScope(ROLES.MANAGER) !== 'all') throw new Error('Manager lead scope must be all.');

console.log('ARCOVA authorization matrix: OK');
