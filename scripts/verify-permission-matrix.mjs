import fs from 'node:fs';

const source = fs.readFileSync(new URL('../lib/permissions.js', import.meta.url), 'utf8');

const requiredSnippets = [
  "if (!role) return null;",
  "if (!normalized) return 'none';",
  "admin: ALL",
  "ceo: ALL",
  "'leads.import'",
  "'users.manage'",
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`Authorization regression: missing ${snippet}`);
  }
}

const forbiddenSnippets = [
  "if (!role) return ROLES.SALES;",
  "if (!normalized) return 'own';",
];

for (const snippet of forbiddenSnippets) {
  if (source.includes(snippet)) {
    throw new Error(`Authorization regression: forbidden fallback found: ${snippet}`);
  }
}

console.log('ARCOVA authorization source checks: OK');
