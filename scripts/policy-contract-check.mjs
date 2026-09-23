import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const statuses = read('lib/leadStatuses.js');
const validation = read('lib/leadValidation.js');
const dashboard = read('pages/dashboard.js');
const updateApi = read('pages/api/leads/update.js');
const deleteApi = read('pages/api/records/delete.js');
const customer360Api = read('pages/api/customer360/records.js');
const duplicateApi = read('pages/api/leads/duplicates.js');
const permissions = read('lib/permissions.js');

const canonicalStatuses = [
  'New Lead', 'Contacted', 'Qualified', 'Interested', 'Project Sent',
  'Meeting', 'Viewing', 'Negotiation', 'Reservation', 'Contract',
  'Closed Won', 'Closed Lost'
];

const legacyStatuses = ['Meeting Set', 'Lost', 'Archived'];

for (const status of [...canonicalStatuses, ...legacyStatuses]) {
  assert.match(statuses, new RegExp(`'${status.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&')}'`), `Missing lead status contract entry: ${status}`);
}

assert.match(validation, /isValidLeadStatus/);
assert.match(updateApi, /isValidLeadStatus\(status\)/);
assert.doesNotMatch(updateApi, /allowedStatuses/);
assert.match(dashboard, /getLeadStatusOptions/);
assert.match(dashboard, /fetch\('\/api\/leads\/update'/);
assert.doesNotMatch(dashboard, /from\('leads'\)\.update\(\{\s*status:\s*newStatus/);

assert.match(deleteApi, /PERMANENT_DELETE_ROLES = new Set\(\['admin'\]\)/);
assert.match(deleteApi, /mode === 'permanent'/);
assert.match(deleteApi, /Permanent deletion is restricted to Admin/);
assert.match(deleteApi, /ARCHIVE_STATUS = new Set\(\[/);

assert.match(customer360Api, /req\.method === 'DELETE' && auth\.role !== 'admin'/);
assert.match(customer360Api, /_PERMANENT_DELETE/);

assert.match(duplicateApi, /role !== 'admin'/);
assert.match(duplicateApi, /body\.confirm !== true/);
assert.match(duplicateApi, /merge_leads_atomic/);

for (const role of ['admin', 'ceo', 'manager', 'team_leader', 'sales', 'finance', 'marketing', 'operations', 'support']) {
  assert.match(permissions, new RegExp(`^[\\t ]+${role}:|${role}:\\s*(ALL|new Set)`, 'm'));
}

const expectedPermissionCounts = {
  admin: 36,
  ceo: 36,
  manager: 33,
  team_leader: 21,
  sales: 21,
  finance: 8,
  marketing: 11,
  operations: 13,
  support: 7,
};

assert.match(permissions, /const ALL = new Set\(Object\.values\(PERMISSIONS\)\)/);
assert.equal((permissions.match(/'[^']+'/g) || []).filter((v) => v.includes('.')).length >= 36, true);

for (const [role, expected] of Object.entries(expectedPermissionCounts)) {
  if (role === 'admin' || role === 'ceo') continue;
  const marker = new RegExp(`\\b${role}\\s*:\\s*new Set\\(\\[(.*?)\\]\\)`, 's');
  const match = permissions.match(marker);
  assert.ok(match, `Permission matrix entry missing for ${role}`);
  const count = (match[1].match(/'[^']+'/g) || []).length;
  assert.equal(count, expected, `Permission count drift for ${role}`);
}

console.log('ARCOVA policy contract checks passed.');
