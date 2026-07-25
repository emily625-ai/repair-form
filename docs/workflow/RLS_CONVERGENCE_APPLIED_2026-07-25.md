# RLS Convergence Applied - 2026-07-25

This document records the production RLS convergence applied to the customer service record system.

## 1. Summary

Production Supabase RLS was tightened for the main customer service tables.

The change removes anonymous frontend table access and keeps only logged-in operator access through the `authenticated` role.

No frontend feature code was changed during this step.

## 2. Production Tables

Applied to:

- `public.cases`
- `public.activity_log`
- `public.line_messages`

## 3. Final Grants

`anon`:

- No direct table grants remain on the target tables.

`authenticated`:

- `public.cases`: `SELECT`, `INSERT`, `UPDATE`
- `public.activity_log`: `SELECT`, `INSERT`
- `public.line_messages`: `SELECT`, `INSERT`, `UPDATE`

`service_role`:

- Existing backend/service privileges remain available.
- This keeps Render LINE webhook and backend-only workflows working.

## 4. Final Policies

Confirmed production policies:

- `activity_log_insert_authenticated`
- `activity_log_select_authenticated`
- `cases_insert_authenticated`
- `cases_select_authenticated`
- `cases_update_authenticated`
- `line_messages_insert_authenticated`
- `line_messages_select_authenticated`
- `line_messages_update_authenticated`

All listed policies are scoped to:

```text
{authenticated}
```

## 5. Delete Policy

DELETE remains unavailable to frontend client roles.

Reason:

- Prevent accidental deletion of production customer service cases.
- Keep test-data deletion as a deliberate SQL Editor action.
- Preserve auditability and reduce operational risk.

Recommended future direction:

- Prefer archive or soft-delete workflow.
- If hard delete is needed, add admin-only delete behavior after role design.

## 6. Verification Performed

The following Supabase audit checks were reviewed after migration:

- `information_schema.role_table_grants`
- `pg_policies`

Confirmed:

- `anon` no longer appears in grants for the target tables.
- Policies no longer include `anon`.
- `authenticated` keeps required frontend operations.
- `service_role` remains available for backend workflows.

## 7. Expected Functional Checks

After this RLS convergence, the live system should be checked with a logged-in operator account:

- Login gate appears before app access.
- Case list loads after login.
- New cases can be saved.
- Existing cases can be edited.
- Activity log can be read and written.
- LINE import list can be refreshed.
- LINE message status changes can be saved.
- Render LINE webhook can continue inserting `line_messages`.

## 8. Rollback Reference

Rollback reference remains in:

```text
docs/sql/rls_convergence_authenticated_only.sql
```

Rollback should be used only if the authenticated workflow fails and after confirming the current audit output.

## 9. Notes

This is the first RLS hardening stage.

It is appropriate for the current single-operator workflow. If the system becomes multi-user, the next security stage should define:

- Admin/operator roles.
- Per-user or per-team row access.
- Admin-only deletion or archive workflows.
- More detailed activity logging for sensitive changes.
