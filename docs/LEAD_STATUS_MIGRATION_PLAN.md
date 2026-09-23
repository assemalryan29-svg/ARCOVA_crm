# ARCOVA lead status migration plan

Verified production state on 2026-09-23:

- Total leads: 393
- Canonical statuses currently present: New Lead (295), Contacted (46), Interested (10)
- Legacy status Meeting Set: 2
- Legacy status Lost: 40
- Legacy status Archived: 0

## Canonical contract

New Lead → Contacted → Qualified → Interested → Project Sent → Meeting → Viewing → Negotiation → Reservation → Contract → Closed Won / Closed Lost

## Legacy compatibility

The application currently accepts legacy values so existing rows are not broken:

- Meeting Set
- Lost
- Archived

New UI choices no longer create legacy values.

## Proposed reviewed mapping

- Meeting Set → Meeting
- Lost → Closed Lost
- Archived → remain Archived, because archive is an operational state rather than a sales stage.

This mapping has **not** been applied to production automatically. The distinction between "Lost" and "Closed Lost" is semantically straightforward, but "Meeting Set" may contain records that have an appointment/follow-up record requiring review before converting the stage.

## Safe migration requirements

Before applying the mapping:

1. Export/backup the current lead status values.
2. Preview every row that would change, including assigned user, next follow-up, appointment/follow-up presence, and latest lead log.
3. Apply the mapping in a single transaction.
4. Record a migration audit entry with before/after counts.
5. Re-check duplicate detection and dashboard pipeline counts.

Do not use a global search/replace in the UI or delete legacy rows.
