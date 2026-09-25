import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, 'pages/dashboard.js'), 'utf8');
const teamController = fs.readFileSync(path.join(root, 'components/TeamController.tsx'), 'utf8');
const gateway = fs.readFileSync(path.join(root, 'pages/api/crm/mutate.js'), 'utf8');
const operations = fs.readFileSync(path.join(root, 'components/OperationsPanel.tsx'), 'utf8');
const automation = fs.readFileSync(path.join(root, 'components/AutomationPanel.tsx'), 'utf8');

const checks = [
  ['dashboard', 'manual lead creation uses server API', /fetch\('\/api\/leads\/create'/],
  ['dashboard', 'lead update uses server API', /fetch\('\/api\/leads\/update'/],
  ['dashboard', 'lead archive uses server API', /fetch\('\/api\/records\/delete'/],
  ['dashboard', 'CSV import uses server API', /fetch\('\/api\/leads\/import'/],
  ['dashboard', 'lead status update has permission gate', /const handleUpdateLeadStatus[\s\S]{0,700}can\(userRole, PERMISSIONS\.LEADS_UPDATE\)/],
  ['dashboard', 'follow-up update has permission gate', /const handleSaveFollowUp[\s\S]{0,600}can\(userRole, PERMISSIONS\.FOLLOWUPS_MANAGE\)/],
  ['dashboard', 'lead assignment has team gate', /const handleAssignLead[\s\S]{0,500}canManageTeam\(userRole\)/],
  ['dashboard', 'folder creation has lead permission gate', /const handleCreateFolder[\s\S]{0,500}PERMISSIONS\.LEADS_CREATE/],
  ['dashboard', 'financial plan has lead update gate', /const handleSaveFinancialPlan[\s\S]{0,500}PERMISSIONS\.LEADS_UPDATE/],
  ['team', 'team role editing uses centralized mutation gateway', /const saveEmployee[\s\S]{0,1600}crmMutation\('PATCH', 'user_roles'/],
  ['team', 'team structure editing uses centralized mutation gateway', /const saveEmployee[\s\S]{0,2200}crmMutation\('PATCH', 'profiles'/],
  ['team', 'team creation uses centralized mutation gateway', /const createTeam[\s\S]{0,700}crmMutation\('POST', 'teams'/],
  ['gateway', 'deals are protected from direct CRUD gateway', !/\bdeals:\s*\{/.test(gateway)],
  ['gateway', 'reservations are protected from direct CRUD gateway', !/\breservations:\s*\{/.test(gateway)],
  ['gateway', 'payments are protected from direct CRUD gateway', !/\bdeal_payments:\s*\{/.test(gateway)],
  ['operations', 'reservation uses atomic RPC', /reserve_unit_atomic/],
  ['operations', 'deal conversion uses protected RPC', /confirm_reservation_as_deal/],
  ['operations', 'payment collection uses protected RPC', /record_deal_payment/],
  ['automation', 'automation rule writes use mutation gateway', /fetch\('\/api\/crm\/mutate'/]
];

const sourceMap = { dashboard, team: teamController, gateway, operations, automation };
const failures = checks.filter(([source, , pattern]) => {
  const target = sourceMap[source] || dashboard;
  return typeof pattern === 'function' ? !pattern(target) : !pattern.test(target);
});
if (failures.length) {
  console.error('CRUD guardrail verification failed:');
  for (const [, name] of failures) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`CRUD guardrails passed (${checks.length} checks).`);
