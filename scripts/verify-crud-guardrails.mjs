import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, 'pages/dashboard.js'), 'utf8');
const teamController = fs.readFileSync(path.join(root, 'components/TeamController.tsx'), 'utf8');

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
  ['team', 'team creation uses centralized mutation gateway', /const createTeam[\s\S]{0,700}crmMutation\('POST', 'teams'/]
];

const failures = checks.filter(([source, , pattern]) => !pattern.test(source === 'team' ? teamController : dashboard));
if (failures.length) {
  console.error('CRUD guardrail verification failed:');
  for (const [, name] of failures) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`CRUD guardrails passed (${checks.length} checks).`);
