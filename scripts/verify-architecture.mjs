import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'pages/dashboard.js',
  'components/FollowupsPanel.tsx',
  'components/OperationsPanel.tsx',
  'components/ReportsPanel.tsx',
  'components/TeamController.tsx'
];

const forbiddenMutation = /supabase\.from\([^)]*\)\.(insert|update|delete|upsert)\s*\(/;
const failures = [];

for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (forbiddenMutation.test(source)) failures.push(file);
}

const authSource = fs.readFileSync(path.join(root, 'lib/auth.js'), 'utf8');
if (!authSource.includes("supabase.from('user_roles')")) failures.push('lib/auth.js canonical user_roles lookup');

const gateway = fs.readFileSync(path.join(root, 'pages/api/crm/mutate.js'), 'utf8');
for (const required of ["user_roles", "app_role_permissions", "Authorization: 'Bearer ' + token", "writeClient.from(table)"]) {
  if (!gateway.includes(required)) failures.push('pages/api/crm/mutate.js missing ' + required);
}

if (failures.length) {
  console.error('Architecture verification failed:');
  failures.forEach((item) => console.error('- ' + item));
  process.exit(1);
}

console.log('ARCOVA architecture checks passed.');
