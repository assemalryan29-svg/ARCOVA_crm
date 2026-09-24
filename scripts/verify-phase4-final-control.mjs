import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260924032800_phase4_final_control.sql', 'utf8');

const required = [
  'phase4_final_audit',
  'phase4_run_final_audit',
  'phase4_validation_results',
  'phase4_duplicate_candidates',
  'phase4_id_mapping',
  'security invoker',
  'approved=false',
];

for (const token of required) {
  if (!migration.toLowerCase().includes(token.toLowerCase())) {
    throw new Error('Phase 4 final control missing: ' + token);
  }
}

if (/delete\\s+from\\s+public\\.phase4_/i.test(migration)) {
  throw new Error('Phase 4 final control must not delete snapshot/control data.');
}

console.log('Phase 4 final control verification: PASS');
