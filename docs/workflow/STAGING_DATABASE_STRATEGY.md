# Staging Database Strategy

This document defines the Supabase staging database strategy for the customer service record system.

The goal is to make every database change reviewable, testable, and reversible before it reaches production.

## 1. Why We Need a Staging Schema

A staging schema is needed because this project handles operational customer service data.

Staging gives us a safer place to validate:

- New tables such as `line_messages`.
- Supabase RLS policies.
- Grants and API role access.
- Import workflows.
- Rollback SQL.
- AI-generated migration drafts.

Rules:

- Migration must not go directly to production.
- AI-generated SQL must be reviewed and tested in staging first.
- All migration must have rollback SQL.
- Production data must not be used directly for casual testing.

## 2. `public` and `staging` Separation Principles

Recommended Supabase structure:

```text
public   = production-facing tables
staging  = pre-production validation tables and workflow testing
```

Principles:

- `public` is the production schema used by the live customer service system.
- `staging` is for migration review, test imports, and workflow validation.
- Staging tables should mirror production table shape when testing migrations.
- Staging data must be anonymized or fake.
- Never assume a migration is production-ready because it works only as a draft.

Naming examples:

```sql
staging.line_messages
public.line_messages
```

Do not:

- Test destructive SQL directly on `public`.
- Add broad `Allow all` policies to `public`.
- Use real customer exports as staging fixtures inside Git.

## 3. `line_messages` Staging Workflow

Recommended first staging flow for LINE import:

1. Create `staging` schema if it does not exist.
2. Create `staging.line_messages` using the migration draft shape.
3. Apply indexes, constraints, and RLS policy drafts in staging.
4. Import anonymized CSV samples.
5. Test manual paste sample rows.
6. Verify duplicate detection through `duplicate_hash`.
7. Verify status transitions:
   - `pending`
   - `classified`
   - `linked`
   - `archived`
   - `error`
8. Verify rollback SQL removes only staging objects.
9. After staging passes review, prepare a production migration for `public.line_messages`.

Staging validation must happen before production release.

## 4. Migration Review Flow

Migration review steps:

1. Confirm the target repo and target schema.
2. Confirm the SQL file is independent.
3. Confirm the SQL file does not modify unrelated tables.
4. Confirm rollback SQL exists.
5. Confirm indexes are named and intentional.
6. Confirm RLS is enabled for sensitive tables.
7. Confirm no `Allow all` policy is introduced.
8. Confirm no production data is included in the repo.
9. Run the migration in staging.
10. Run workflow tests.
11. Run rollback in staging.
12. Re-run migration in staging after rollback to confirm repeatability.
13. Approve for production only after staging passes.

## 5. Rollback SOP

Every migration must include rollback SQL.

Rollback SOP:

1. Identify the exact migration file.
2. Identify all created tables, indexes, policies, triggers, and grants.
3. Confirm rollback affects only objects created by that migration.
4. Run rollback in staging first.
5. Confirm the target objects are removed or restored as expected.
6. Confirm existing tables such as `cases` and `activity_log` are untouched.
7. Save rollback result notes in `SQL_Backup/` or `Staging/`.
8. Only use rollback in production after confirming impact.

Rollback SQL must be readable before execution.

## 6. Migration Execution Pre-Checklist

Before running any migration:

- Confirm target schema: `staging` or `public`.
- Confirm database project: staging or production.
- Confirm the SQL file has rollback SQL.
- Confirm the SQL file has no accidental `drop` against existing production tables.
- Confirm RLS impact is understood.
- Confirm grants are not broader than needed.
- Confirm indexes are necessary and named.
- Confirm test data is anonymized.
- Confirm current schema or policy backup exists.
- Confirm Git has the migration draft committed or staged for review.

Do not execute if the target is unclear.

## 7. Production Deploy Checklist

Before production deployment:

- Staging migration has passed.
- Staging rollback has passed.
- Staging re-run after rollback has passed.
- RLS review is complete.
- SQL backup is complete.
- The migration has been reviewed against `AGENTS.md` and `RULES.md`.
- The user has approved production execution.
- The affected frontend or API workflow has a test plan.
- Rollback SQL is available during the production change.

After production deployment:

- Confirm table exists.
- Confirm indexes exist.
- Confirm RLS is enabled.
- Confirm grants and policies are correct.
- Confirm the affected workflow still works.
- Record the result in the relevant workflow or SQL document.

## 8. RLS Review Checklist

For every table exposed through Supabase:

- RLS is enabled.
- No `Allow all` policy exists.
- `anon` access is intentionally limited.
- `authenticated` access is intentionally limited.
- `service_role` is not exposed to frontend code.
- `select` policies match real operator needs.
- `insert` policies match approved workflows.
- `update` policies allow only intended status or data changes.
- `delete` is restricted or disabled for client roles.
- Policy names clearly describe the action and role.
- Policies are tested in staging before production.

For `line_messages`:

- Operators can read pending messages only if authorized.
- Insert is limited to approved import workflow.
- Update supports classification, linking, archiving, and error resolution.
- Delete remains restricted.

## 9. SQL Backup Checklist

Before migration:

- Save current policy audit output.
- Save current grants output.
- Save current table structure if modifying an existing table.
- Store backups in `SQL_Backup/` when appropriate.
- Use date and purpose in backup filenames.

Suggested naming:

```text
2026-05-16_before_line_messages_rls.sql
2026-05-16_line_messages_rollback.sql
2026-05-16_staging_validation_notes.md
```

Do not store real customer data in SQL backup files.

## 10. Git Commit Checklist

Before commit:

- Run `git status`.
- Confirm only intended files are included.
- Confirm no real customer data or Excel export is included.
- Confirm migration and rollback are both present.
- Confirm docs describe staging and production behavior.
- Confirm no unrelated frontend or API code is included.

Commit message examples:

```text
docs: add line messages migration draft
sql: add staging line messages migration
docs: define staging database strategy
```

Do not push until the user approves.

## 11. Staging Test Flow

Recommended staging test flow:

1. Apply migration to `staging`.
2. Confirm table and indexes.
3. Confirm status constraint.
4. Insert anonymized sample rows.
5. Insert duplicate sample with the same `duplicate_hash`.
6. Confirm partial unique index blocks duplicate non-null hash.
7. Insert row with null `duplicate_hash`.
8. Confirm null hash rows can exist for error handling.
9. Test status transitions.
10. Test RLS policies with intended role.
11. Run rollback.
12. Confirm rollback does not affect `public`.

Staging test result should include:

- Migration result.
- Duplicate test result.
- RLS test result.
- Rollback result.
- Any issue found before production.

## 12. Production Release Flow

Production release flow:

1. Confirm staging has passed.
2. Confirm rollback SQL is ready.
3. Confirm backup checklist is complete.
4. Confirm production target is `public`.
5. Confirm user approval.
6. Execute production migration.
7. Verify table, indexes, constraints, RLS, and grants.
8. Verify affected UI or API workflow.
9. Record release notes.
10. Keep rollback SQL available until the release is confirmed stable.

Production migration must be intentional, reviewed, and reversible.

## Summary

Use staging as the safety gate for Supabase changes.

AI may draft SQL, but staging validation is required before production execution. Every migration must be independent, documented, and rollback-capable. Existing production workflow and UI style should remain stable unless the user explicitly requests a behavior change.
