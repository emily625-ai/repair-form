# Customer Service Core System Checklist

This checklist is for validating the current customer service record system before adding new features.

LINE import is paused. Do not include LINE import, `line_messages`, or new database migrations in this checklist unless the user explicitly resumes that work.

## Scope

Validate the existing production-facing workflows:

- Case list
- Add case
- Edit case
- Delete case
- Close case
- Dispatch status
- Invoice status
- Warranty status
- Activity log
- Report export

Do not change:

- Auth behavior
- Supabase keys
- RLS policies
- Production schema
- Report API deployment settings

## Pre-Check

Before testing:

- Confirm the active frontend repo is `F:\07_網站與專案\repair-form`.
- Confirm the report API repo is `C:\Users\emily\OneDrive\文件\New project\report-api`.
- Confirm `git status` is clean or only contains intended changes.
- Use local server testing instead of `file://`.
- Do not use real destructive customer data for tests.
- Do not execute SQL unless the task explicitly requires it.

## Required Modification Procedure

Use this procedure before changing code, SQL, or deployment-related settings:

1. Confirm the requirement and the intended outcome.
2. Run `git status` in the affected repo before editing.
3. Keep the modification small and limited to necessary files.
4. Test locally or verify the affected workflow.
5. Update the relevant documentation or change record.
6. Split commits by purpose, such as UI, API, SQL, reports, or docs.
7. Push only after confirming the commit scope is clean.
8. Verify the production page, Render deploy, or Supabase result after deployment.

Do not mix unrelated changes in one commit. If existing uncommitted changes are present, preserve them and avoid overwriting user work.

Recommended local URL:

```text
http://127.0.0.1:8765/客服記錄系統.html
```

## 1. Case List

Check:

- Case list loads successfully.
- Total count matches visible filters.
- Table columns remain readable.
- Long issue descriptions do not break the table.
- Horizontal scroll works when needed.
- Date range filters work.
- Status filters work.
- Owner, channel, warranty, and overdue filters work.
- Clear filters returns to the expected default list.

Risk to watch:

- Small text or low contrast after UI changes.
- Filters pointing to report views instead of list views.
- Cached JavaScript after deployment.

## 2. Add Case

Check:

- New case modal opens.
- Required fields are clear.
- Default channel remains appropriate.
- Category and subcategory dropdowns work.
- Status options include current operational statuses.
- Save creates exactly one case.
- Created case appears in the list after refresh.
- `activity_log` records the create action when supported.

Risk to watch:

- Missing required fields accepted silently.
- Duplicate IDs.
- Form values carrying over from previous edits.

## 3. Edit Case

Check:

- Edit opens the selected case.
- Existing data is loaded correctly.
- Date/time fields remain valid.
- Category and subcategory remain matched.
- Saving updates only the intended case.
- List refresh shows updated values.
- `activity_log` records meaningful before/after changes when supported.

Risk to watch:

- Editing one row updates another row.
- Blank optional fields overwrite existing values unintentionally.
- Status changes do not appear in activity log.

## 4. Delete Case

Check:

- Delete requires operator confirmation.
- Delete removes only the selected case.
- Deleted case no longer appears after refresh.
- Related `activity_log` behavior is understood.
- RLS allows only intended delete workflow.

Risk to watch:

- Delete button active for unintended users.
- No confirmation before delete.
- Orphaned activity records are acceptable only if documented.

## 5. Close Case

Check:

- Close status can be selected.
- Close date/time is recorded correctly.
- Final result field can be saved.
- Closed case no longer appears in unresolved filters.
- Close notification copy still works if used.
- `activity_log` records close action.

Risk to watch:

- Closed cases still counted as unresolved.
- Close time uses wrong date field.
- Report logic uses incoming date instead of dispatch/close date where required.

## 6. Dispatch Status

Check:

- Dispatch status values are complete.
- Dispatch owner is visible and editable.
- Dispatch date/time is recorded correctly.
- Overdue indicators use the expected date rule.
- Status overview reports use dispatch date when required.

Risk to watch:

- Mixed usage of incoming date and dispatch date.
- Status badge colors becoming inconsistent.
- Missing status option such as customer confirmation states.

## 7. Invoice Status

Check:

- Invoice-needed cases are visible.
- Invoice filters open the case list, not the report view.
- Invoice status can be updated.
- Invoice fields do not block unrelated case edits.
- Dashboard counters match filtered cases.

Risk to watch:

- Invoice shortcut navigates to the wrong tab.
- Filter count and visible rows disagree.
- Invoice status not represented in export.

## 8. Warranty Status

Check:

- Warranty in/out/blank states display clearly.
- Warranty filter works.
- Warranty value is preserved during edit.
- Warranty status appears in list and detail views.

Risk to watch:

- Blank and unknown states look identical.
- Warranty badge color is too low contrast.

## 9. Activity Log

Check:

- Activity log tab loads.
- Recent create, edit, close, delete, and status changes appear.
- Log entries show case ID, action, operator, and timestamp when available.
- Permission errors are visible and understandable.
- RLS does not expose more log data than intended.

Risk to watch:

- `activity_log` SELECT policy missing.
- Mutations succeed but no log is written.
- Log timestamps use inconsistent timezone.

## 10. Report Export

Check:

- Weekly report downloads successfully.
- Monthly report downloads successfully.
- Report API endpoint is reachable.
- Report date range matches UI selection.
- Status overview report uses the expected date field.
- Exported Excel columns match current operational needs.

Risk to watch:

- Frontend repo changes mixed with report API changes.
- Render deployment not updated after API changes.
- Report uses stale logic after frontend label changes.

## 11. Security And Data Safety

Check:

- No service role key appears in frontend code.
- No real customer export is committed.
- No production SQL is executed from local testing.
- RLS changes are handled as separate SQL drafts.
- All SQL has rollback notes.
- `SQL_Backup/` contains only safe audit or rollback material.

Risk to watch:

- Temporary CSV or Excel files accidentally added to Git.
- Production migration run before staging review.
- Auth or RLS modified as part of UI work.

## 12. Release Checklist

Before commit:

- Run `git status`.
- Confirm only intended files changed.
- Confirm no auth changes.
- Confirm no production migration changes unless explicitly requested.
- Confirm no Supabase connection was added for paused features.
- Confirm UI changes keep the existing dashboard style.

Before push:

- Confirm local test passed.
- Confirm GitHub Pages or Render target is correct.
- Confirm no temporary files are included.
- Confirm the user approved the push.

## Current Priority

Recommended next steps:

1. Keep LINE import paused.
2. Validate the current case list and core case workflows.
3. Confirm report export rules separately in the report API repo.
4. Only resume database migration work through staging-first review.
