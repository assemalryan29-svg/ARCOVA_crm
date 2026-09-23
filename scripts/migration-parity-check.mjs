import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const expected = [
  '20260919200301_secure_inventory_access_policies.sql',
  '20260919200413_secure_tables_without_policies.sql',
  '20260919201151_arcova_authorization_hardening_v1.sql',
  '20260919201253_arcova_authorization_hardening_v2.sql',
  '20260919205318_align_dashboard_schema_fields.sql',
  '20260919205327_set_task_owner_from_authenticated_user.sql',
  '20260919205331_add_project_description_compatibility.sql',
  '20260919205731_arcova_compatibility_triggers.sql',
  '20260919210332_secure_task_owner_function.sql',
  '20260919210645_lock_task_owner_function_execution.sql',
  '20260921005012_phase1_lead_duplicate_guard.sql',
  '20260921005142_phase1_duplicate_reporting_view.sql',
  '20260921011248_phase2_lead_ingestion_hardening.sql',
  '20260921145019_add_user_preferences_unique_key.sql',
  '20260921153135_add_campaign_status_and_indexes.sql',
  '20260921154306_phase3_operational_financial_integrity.sql',
  '20260921154320_remove_duplicate_installment_index.sql',
  '20260921191039_cleanup_lead_indexes_and_normalized_data.sql',
  '20260921222137_cleanup_lead_indexes_and_normalized_data.sql',
  '20260921231300_sync_lead_normalization_cleanup.sql',
  '20260921233336_remove_duplicate_leads_created_index.sql',
  '20260921235746_security_and_data_cleanup.sql',
  '20260922004711_lead_normalization_write_consistency.sql',
  '20260922010956_harden_normalization_function_search_paths.sql',
  '20260923000759_phase1_atomic_lead_merge.sql',
  '20260923000817_phase1_atomic_lead_merge_fix.sql',
  '20260923000856_phase1_merge_identity_guard.sql',
];

const dir = path.resolve(process.cwd(), 'supabase/migrations');
const actual = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
const expectedSorted = [...expected].sort();

assert.deepEqual(
  actual,
  expectedSorted,
  [
    'Supabase migration parity drift detected.',
    'Repository migration filenames must exactly match the verified production history.',
    'Do not add aliases, rename historical files, or omit recorded production versions.',
  ].join(' ')
);

for (const file of expectedSorted) {
  const fullPath = path.join(dir, file);
  const sql = fs.readFileSync(fullPath, 'utf8').trim();
  assert.ok(sql.length > 0, `Migration is empty: ${file}`);
}

console.log(`Supabase migration parity check passed: ${expectedSorted.length} canonical migrations.`);
