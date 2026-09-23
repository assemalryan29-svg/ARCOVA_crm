import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, 'pages/dashboard.js'), 'utf8');
const teamController = fs.readFileSync(path.join(root, 'components/TeamController.tsx'), 'utf8');

const checks = [
  ['manual lead creation uses server API', /fetch\('\/api\/leads\/create'/],
  ['lead update uses server API', /fetch\('\/api\/leads\/update'/],
  ['lead archive uses server API', /fetch\('\/api\/records\/delete'/],
  ['CSV import uses server API', /fetch\('\/api\/leads\/import'/],
  ['lead status update has permission gate', /const handleUpdateLeadStatus[\s\S]{0,500}can\(userRole, PERMISSIONS\.LEADS_UPDATE\)/],
  ['follow-up update has permission gate', /const handleSaveFollowUp[\s\S]{0,400}can\(userRole, PERMISSIONS\.FOLLOWUPS_MANAGE\)/],
  ['lead assignment has team gate', /const handleAssignLead[\s\S]{0,300}canManageTeam\(userRole\)/],
  ['folder creation has lead permission gate', /const handleCreateFolder[\s\S]{0,350}PERMISSIONS\.LEADS_CREATE/],
  ['financial plan has lead update gate', /const handleSaveFinancialPlan[\s\S]{0,300}PERMISSIONS\.LEADS_UPDATE/],
  ['team role editing has users permission gate', /const saveEmployee[\s\S]{0,300}PERMISSIONS\.USERS_MANAGE/],
  ['team creation has teams permission gate', /const createTeam[\s\S]{0,250}PERMISSIONS\.TEAMS_MANAGE/]
];

const failures = checks.filter(([, pattern]) => !pattern.test(pattern === checks[9]?.[1] ? teamController : dashboard));

if (failures.length) {
  console.error('CRUD guardrail verification failed:');
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`CRUD guardrails passed (${checks.length} checks).`);
