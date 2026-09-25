import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, 'pages/dashboard.js'), 'utf8');
const campaignPanel = fs.readFileSync(path.join(root, 'components/CampaignsPanel.tsx'), 'utf8');
const createLead = fs.readFileSync(path.join(root, 'pages/api/leads/create.js'), 'utf8');
const updateLead = fs.readFileSync(path.join(root, 'pages/api/leads/update.js'), 'utf8');
const importLead = fs.readFileSync(path.join(root, 'pages/api/leads/import.js'), 'utf8');
const gateway = fs.readFileSync(path.join(root, 'pages/api/crm/mutate.js'), 'utf8');

const checks = [
  ['dashboard imports CampaignsPanel', /CampaignsPanel/],
  ['dashboard creates leads with campaign_id', /campaign_id: newLeadData\.campaign_id/],
  ['dashboard edits lead campaign_id', /campaign_id: selectedLead\.campaign_id/],
  ['campaign panel loads opportunities', /from\('opportunities'\)/],
  ['campaign panel loads deals for authorized roles', /from\('deals'\)/],
  ['campaign panel calculates ROAS', /roas/],
  ['campaign panel calculates ROI', /roi/],
  ['lead create accepts campaign_id', /campaign_id: text\(body\.campaign_id/],
  ['lead update accepts campaign_id', /campaign_id: text\(body\.campaign_id/],
  ['lead import accepts campaign_id', /campaign_id: String\(lead\?\.campaign_id/],
  ['generic CRM gateway allows campaign_id on leads', /external_lead_id','campaign_id'/]
];

const sources = { dashboard, campaignPanel, createLead, updateLead, importLead, gateway };
const failures = [];

for (const [name, pattern] of checks) {
  const source =
    name.startsWith('dashboard') ? dashboard :
    name.startsWith('campaign panel') ? campaignPanel :
    name.startsWith('lead create') ? createLead :
    name.startsWith('lead update') ? updateLead :
    name.startsWith('lead import') ? importLead :
    gateway;
  if (!pattern.test(source)) failures.push(name);
}

if (failures.length) {
  console.error('Campaign attribution verification failed:');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}

console.log('ARCOVA campaign attribution checks passed (' + checks.length + ' checks).');
