# ARCOVA Supabase migration baseline

Snapshot verified against the production Supabase project on 2026-09-23.

## Production facts

- Database engine: PostgreSQL 17.6.1.166
- Production migration records verified: 27
- No production data rewrite or migration reset was performed.

## Verified production migration history

| Version | Name |
|---|---|
| 20260919200301 | secure_inventory_access_policies |
| 20260919200413 | secure_tables_without_policies |
| 20260919201151 | arcova_authorization_hardening_v1 |
| 20260919201253 | arcova_authorization_hardening_v2 |
| 20260919205318 | align_dashboard_schema_fields |
| 20260919205327 | set_task_owner_from_authenticated_user |
| 20260919205331 | add_project_description_compatibility |
| 20260919205731 | arcova_compatibility_triggers |
| 20260919210332 | secure_task_owner_function |
| 20260919210645 | lock_task_owner_function_execution |
| 20260921005012 | phase1_lead_duplicate_guard |
| 20260921005142 | phase1_duplicate_reporting_view |
| 20260921011248 | phase2_lead_ingestion_hardening |
| 20260921145019 | add_user_preferences_unique_key |
| 20260921153135 | add_campaign_status_and_indexes |
| 20260921154306 | phase3_operational_financial_integrity |
| 20260921154320 | remove_duplicate_installment_index |
| 20260921191039 | cleanup_lead_indexes_and_normalized_data |
| 20260921222137 | cleanup_lead_indexes_and_normalized_data |
| 20260921231300 | sync_lead_normalization_cleanup |
| 20260921233336 | remove_duplicate_leads_created_index |
| 20260921235746 | security_and_data_cleanup |
| 20260922004711 | lead_normalization_write_consistency |
| 20260922010956 | harden_normalization_function_search_paths |
| 20260923000759 | phase1_atomic_lead_merge |
| 20260923000817 | phase1_atomic_lead_merge_fix |
| 20260923000856 | phase1_merge_identity_guard |

## Reconciliation status

The production database reports the migration versions/names above. The repository now contains the three new phase-1 merge migrations:

- `20260923000759_phase1_atomic_lead_merge.sql`
- `20260923000817_phase1_atomic_lead_merge_fix.sql`
- `20260923000856_phase1_merge_identity_guard.sql`

The SQL bodies for older production migrations are not exposed by the available Supabase migration-history API; that API returns version/name metadata only. Therefore this branch does **not** invent replacement SQL for older missing migration files and does **not** reset or mark production history.

## Required final reconciliation

Before closing the migration-drift item, obtain the canonical SQL source/archive for the older production migrations and restore every verified migration file into `supabase/migrations/` in the exact historical order. Then compare the resulting repository migration set against the production list before the next production schema change.

This document is a baseline/recovery record, not a license to run `db reset`, rewrite migration history, or delete production migration records.
