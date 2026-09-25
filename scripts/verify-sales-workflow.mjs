import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const operations = fs.readFileSync(path.join(root, 'components/OperationsPanel.tsx'), 'utf8');
const pipeline = fs.readFileSync(path.join(root, 'components/OpportunityPipeline.tsx'), 'utf8');
const reports = fs.readFileSync(path.join(root, 'components/ReportsPanel.tsx'), 'utf8');
const automation = fs.readFileSync(path.join(root, 'components/AutomationPanel.tsx'), 'utf8');
const gateway = fs.readFileSync(path.join(root, 'pages/api/crm/mutate.js'), 'utf8');
const customer360 = fs.readFileSync(path.join(root, 'pages/api/crm/customer360.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'pages/dashboard.js'), 'utf8');

const checks = [
  ['pipeline uses create_opportunity RPC', /create_opportunity/],
  ['pipeline uses advance_opportunity_stage RPC', /advance_opportunity_stage/],
  ['reservations use reserve_unit_atomic RPC', /reserve_unit_atomic/],
  ['reservation release uses release_reservation_atomic RPC', /release_reservation_atomic/],
  ['deals use confirm_reservation_as_deal RPC', /confirm_reservation_as_deal/],
  ['installment schedules use generate_deal_payment_schedule RPC', /generate_deal_payment_schedule/],
  ['collections use record_deal_payment RPC', /record_deal_payment/],
  ['reports fetch pipeline summary', /crm_pipeline_stage_summary/],
  ['reports calculate weighted pipeline', /weightedPipeline/],
  ['automation panel uses gateway', /\/api\/crm\/mutate/],
  ['customer 360 loads opportunities', /opportunities/],
  ['customer 360 loads payment timeline', /deal_payments/],
  ['dashboard exposes automation view', /AutomationPanel/],
  ['dashboard inventory does not expose direct status handler', !/handleUpdateUnitStatus/.test(dashboard)],
  ['gateway blocks direct unit status updates', /Unit status changes must use the protected reservation\/deal workflow/.test(gateway)],
];

const failures = [];
for (const [name, pattern] of checks) {
  const source =
    name.includes('reports') ? reports :
    name.includes('automation') ? automation :
    name.includes('customer 360') ? customer360 :
    name.includes('dashboard') ? dashboard :
    (name.includes('pipeline') || name.includes('installment') || name.includes('collection') || name.includes('reservations') || name.includes('reservation release') || name.includes('deals use')) ? (name.includes('pipeline') ? pipeline : operations) :
    gateway;
  const passed = typeof pattern === 'boolean' ? pattern : pattern.test(source);
  if (!passed) failures.push(name);
}

for (const forbidden of [
  /\bdeals:\s*\{/,
  /\breservations:\s*\{/,
  /\bdeal_payments:\s*\{/
]) {
  if (forbidden.test(gateway)) failures.push('sensitive table exposed in mutation gateway');
}

if (failures.length) {
  console.error('Sales workflow verification failed:');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}

console.log(`ARCOVA sales workflow checks passed (${checks.length + 3} checks).`);
