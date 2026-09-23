# ARCOVA CRM — Phase 4 Data Migration Runbook

## Safety contract

- Dry-run and backup first; no automatic deletion, merge, reassignment, or ID replacement.
- Existing UUIDs remain canonical unless an explicitly approved merge is executed.
- Duplicate candidates require manual review and approval.
- `public.merge_leads_atomic()` is the only permitted lead merge path.
- A migration is not approved unless every validation gate passes.

## Gates

1. **Backup**: every live table listed in the Phase 4 migration has a same-run backup; live and backup counts match.
2. **Mapping**: all foreign-key references resolve; no orphaned `lead_id`, `assigned_to`, `project_id`, `unit_id`, or `deal_id` values.
3. **Duplicate review**: candidates are stored in `public.phase4_duplicate_candidates`; status stays `PENDING` until an authorized human reviews them.
4. **Identity**: `profiles` and `user_roles` contain the same user IDs and have no role mismatch.
5. **Reconciliation**: before/after counts and related-row repoint counts must be recorded for every approved merge.
6. **Approval**: no production merge/delete is executed from a dry-run script. Approval must be explicit and auditable.

## Current baseline (2026-09-23)

- Leads: 393
- Profiles: 6
- User roles: 6
- Lead logs: 298
- Follow-ups: 4
- Tasks: 3
- Projects: 1
- Teams: 1
- Campaigns: 1
- Duplicate detection remains review-only.

The backup and validation migration is non-destructive. Empty operational tables are still backed up so later imports cannot silently skip a table.
