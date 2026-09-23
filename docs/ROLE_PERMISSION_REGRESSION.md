# ARCOVA role / permission regression baseline

Verified against the production Supabase project on 2026-09-23.

## Database permission counts

| Role | DB permissions |
|---|---:|
| admin | 36 |
| ceo | 36 |
| manager | 33 |
| finance | 8 |
| marketing | 11 |
| operations | 13 |
| sales | 21 |
| support | 7 |
| team_leader | 21 |

The application permission matrix in `lib/permissions.js` is kept at the same baseline counts for these roles.

## Lead visibility contract

The application maps the lead scope as follows:

- Admin / CEO / Manager: all leads
- Team Leader: team-scoped leads
- Sales: own leads
- Finance: no lead scope
- Marketing / Operations / Support: their application-defined scope, with RLS remaining authoritative

The database RLS layer is the final authorization boundary; hiding a menu item in the frontend is not treated as security.

## Live RLS baseline

The following production tables were verified with RLS enabled:

- leads
- user_roles
- projects
- units
- calls
- followups
- appointments
- reservations
- deals
- deal_payments
- tasks
- campaigns
- audit_logs

The lead merge RPC is intentionally restricted to `service_role` EXECUTE; `anon` and `authenticated` do not have EXECUTE permission.

## Regression rule

Any role/permission change should update both:

1. `lib/permissions.js`
2. the corresponding database role permission rows / RLS policy behavior

Then rerun `npm test` and a live permission audit before merge.
