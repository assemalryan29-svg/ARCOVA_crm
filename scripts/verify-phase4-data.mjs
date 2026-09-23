import fs from 'node:fs';

const migrationDir = 'supabase/migrations';
const files = fs.readdirSync(migrationDir).filter((name) => name.includes('phase4'));

const requiredTokens = [
  'phase4_validation_results',
  'phase4_id_mapping',
  'phase4_approval',
  'phase4_can_approve',
  'phase4_duplicate_candidates',
];

if (files.length === 0) {
  throw new Error('Phase 4 migration control is missing.');
}

const source = files.map((file) => fs.readFileSync(`${migrationDir}/${file}`, 'utf8')).join('\n');

for (const token of requiredTokens) {
  if (!source.includes(token)) throw new Error(`Phase 4 guardrail missing: ${token}`);
}

const forbidden = [
  /\bdelete\s+from\s+(?!public\.phase4_validation_results\b)/i,
  /\btruncate\b/i,
  /\bdrop\s+table\b/i,
  /\bupdate\s+public\.(leads|profiles|user_roles)\b/i,
];

for (const pattern of forbidden) {
  if (pattern.test(source)) throw new Error(`Potentially destructive Phase 4 SQL detected: ${pattern}`);
}

console.log(`Phase 4 code guardrail passed: ${files.length} migration file(s) inspected.`);
