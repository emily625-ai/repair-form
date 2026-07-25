# RLS Convergence Plan

This document defines the first production RLS convergence plan for the customer service record system.

The goal is to move the live Supabase access model from broad public access toward authenticated operator access, without changing existing frontend behavior and without executing SQL directly from this repository.

## 1. Scope

Target production-facing tables:

- `public.cases`
- `public.activity_log`
- `public.line_messages`

Out of scope:

- Auth UI redesign.
- Supabase Auth configuration changes.
- Report API behavior changes.
- LINE webhook endpoint changes.
- Historical data cleanup.
- Executing the migration from this repository.

## 2. Current Frontend Access Pattern

The frontend now uses a logged-in Supabase Auth access token when available.

Observed table usage:

- `cases`: `select`, `insert`, `update`
- `activity_log`: `select`, `insert`
- `line_messages`: `select`, `update`

Optional existing import workflows may still require:

- `line_messages`: `insert`

Delete should remain unavailable from client roles. Test-data deletion should continue to be handled manually through reviewed SQL.

## 3. RLS Direction

Recommended first convergence:

- Remove broad `Allow all` policies if they exist.
- Remove direct `anon` table access for the target tables.
- Enable RLS on the target tables.
- Allow only `authenticated` users to read and write the operations currently needed by the UI.
- Keep `service_role` behavior untouched for backend-only workflows such as LINE webhook imports.
- Do not add new delete policies for `anon` or `authenticated`.

This is still an operator-level gate, not a per-user ownership model. Per-user row restrictions can be designed later after the team defines roles, ownership, and admin needs.

## 4. Policy Matrix

| Table | Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- | --- |
| `cases` | `anon` | No | No | No | No |
| `cases` | `authenticated` | Yes | Yes | Yes | No |
| `activity_log` | `anon` | No | No | No | No |
| `activity_log` | `authenticated` | Yes | Yes | No | No |
| `line_messages` | `anon` | No | No | No | No |
| `line_messages` | `authenticated` | Yes | Yes | Yes | No |

## 5. Migration Rules

- Run the audit SQL first and save output before applying changes.
- Apply in staging or a copied Supabase project first whenever possible.
- Do not execute production SQL until the user confirms.
- Keep rollback SQL available in the same SQL file.
- Do not weaken existing policies as part of a hotfix unless approved.
- Do not expose `service_role` keys in frontend code.

## 6. Validation Checklist

Before production execution:

- Confirm the frontend login page works.
- Confirm at least one operator account can log in.
- Confirm the frontend data module sends the Supabase Auth bearer token after login.
- Confirm stored login sessions expire cleanly and require the operator to log in again.
- Confirm LINE webhook still uses backend credentials and does not depend on frontend `anon` grants.
- Backup current RLS policies and grants.
- Review the rollback section before running the migration.
- Confirm all target tables exist before running the migration.

After production execution:

- Logged-out browser should not be able to load case data.
- Logged-in browser should load the case list.
- Logged-in browser should create a new case.
- Logged-in browser should edit a case.
- Logged-in browser should read and write activity log entries.
- LINE import page should load pending messages.
- LINE message status updates should save.
- Render LINE webhook should still insert new `line_messages`.
- Delete actions should not be available through client-side RLS.

## 7. Review Notes

This convergence is suitable as a first RLS hardening step because it matches the current login-based frontend:

- It blocks unauthenticated public reads and writes.
- It preserves required logged-in operator actions.
- It avoids client-side delete access.
- It keeps backend service-role workflows independent from frontend grants.

Known limitation:

- Any authenticated Supabase user can access all three target tables. This is acceptable for the current single-operator workflow, but a future multi-user rollout should add role-based or ownership-based policies.
- If an operator leaves the page open past token expiry, they may need to refresh and log in again before saving.

## 8. Rollback Principle

Rollback should be used only if the login-based workflow fails after the migration.

Preferred rollback order:

1. Restore grants and policies from the pre-migration audit output.
2. If audit output is unavailable, use the rollback block in the SQL draft.
3. Re-test the live page immediately after rollback.
4. Record the incident and exact SQL used.

## 9. Related SQL Draft

SQL draft:

```text
docs/sql/rls_convergence_authenticated_only.sql
```

This file is a draft only. Do not run it automatically.
