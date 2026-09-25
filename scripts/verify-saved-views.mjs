import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gateway = fs.readFileSync(path.join(root, 'pages/api/crm/mutate.js'), 'utf8');
const permissions = fs.readFileSync(path.join(root, 'lib/permissions.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'pages/dashboard.js'), 'utf8');
const component = fs.readFileSync(path.join(root, 'components/SavedViewsBar.tsx'), 'utf8');

const checks = [
  ['saved_views exists in mutation gateway', /saved_views: \{ permission: 'views\.manage'/],
  ['gateway forces saved view owner', /if \(table === 'saved_views'\) payload\.user_id = actor\.user\.id/],
  ['client exposes views permissions', /VIEWS_VIEW: 'views\.view'/],
  ['dashboard imports saved views bar', /SavedViewsBar/],
  ['dashboard stores lead filter state', /leadSavedFilters/],
  ['dashboard supports advanced status filter', /leadStatusFilter/],
  ['dashboard supports temperature filter', /leadTemperatureFilter/],
  ['dashboard supports assignee filter', /leadAssigneeFilter/],
  ['saved views persist filters', /filters,/],
  ['saved views delete through protected gateway', /await mutate\('DELETE', \{\}, selected\)/]
];

const sources = { gateway, permissions, dashboard, component };
const failures = [];

for (const [name, pattern] of checks) {
  const source =
    name.includes('gateway') && !name.includes('delete') ? gateway :
    name.includes('client') ? permissions :
    name.startsWith('dashboard') ? dashboard :
    component;
  if (!pattern.test(source)) failures.push(name);
}

if (failures.length) {
  console.error('Saved views verification failed:');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}

console.log('ARCOVA saved views checks passed (' + checks.length + ' checks).');
