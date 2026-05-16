# Development Rules

These rules apply to AI-assisted work on the customer service record system.

## Non-Negotiable Rules

- Do not modify auth flows, login behavior, API keys, or security assumptions without explicit approval.
- Do not store production data, Excel exports, customer records, or secrets in Git.
- Do not change Supabase policies without a separate SQL file and rollback plan.
- Do not merge unrelated refactors into a requested fix.
- Do not change the current UI style unless the user asks for visual changes.
- Do not bypass `activity_log` for create, update, import, status change, or batch operations.

## Supabase and SQL

- Every migration must be independent and named by date and purpose.
- Every SQL file must be safe to review before execution.
- Every SQL change must include rollback instructions or a paired rollback script.
- RLS must stay enabled for sensitive public tables.
- `Allow all` style policies are not acceptable for production data.
- `DELETE` permissions must remain restricted unless explicitly approved.

## API Rules

- All API calls must handle network failure, non-2xx responses, invalid payloads, and empty results.
- Error messages should be useful to the operator without exposing secrets.
- Report API changes must be tested with weekly and monthly export flows.
- API endpoint changes must be documented in `docs/api/`.

## Frontend Rules

- Preserve the current dashboard style and information density.
- Keep table behavior predictable for long daily use.
- Keep changes scoped to the target module.
- Avoid inline production data in HTML or JavaScript.
- Do not add new dependencies unless they are clearly necessary.

## Activity Log Rules

- Case creation must write an activity record when logging is available.
- Case updates must record the changed action.
- Status changes must be logged.
- Batch actions must be logged with enough context to audit later.
- Import workflows must record import summary or per-case changes where feasible.

## Git Workflow Rules

- Check `git status` before editing and before committing.
- Keep commits focused.
- Use branch names that identify the change type.
- Do not commit generated Excel reports, SQL result exports with real data, or local scratch files.
- For deployable changes, verify the target repository:
  - Frontend: `repair-form`
  - Report API: `report-api`

## Backup SOP

- Before Supabase changes, run an audit query and store the result in `SQL_Backup/`.
- Before report API deployment, record what report behavior is expected to change.
- Before frontend deployment, confirm which local repo is the GitHub Pages source.
- Keep rollback SQL close to the forward SQL.

## Staging SOP

- Use `Staging/` for temporary verification notes.
- Test frontend changes with a hard refresh to avoid stale JavaScript.
- Test report changes after Render shows the new commit as live.
- Verify affected exports or screens before calling work complete.

## AI Prompting Rules

- Give the AI the target repo path.
- State whether the change is frontend, report API, SQL, or documentation.
- State whether existing functionality may be modified.
- Ask for a file list and verification summary after changes.
- For risky changes, request a rollback plan before implementation.
