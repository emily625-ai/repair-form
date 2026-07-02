# AI Development Guide

This repository is the frontend project for the customer service record system.

## Project Purpose

- Customer service case records
- Report export workflows
- Supabase data access
- LINE message cleanup and case conversion
- Excel import and export support

## Required Guardrails

- Do not modify authentication or authorization behavior unless the user explicitly requests it.
- Do not weaken Supabase RLS, grants, or policy controls.
- Keep migrations independent. Each schema or policy change must be in its own SQL file.
- Every SQL change must include a rollback path or a clearly paired rollback file.
- Every API change must include error handling for failed requests, invalid data, and unavailable services.
- Every data mutation must write to `activity_log` when the existing workflow supports it.
- Preserve the current UI style, layout language, and operational dashboard feel.
- Do not commit real customer data, exported Excel files, local backups, or secrets.

## Repository Responsibilities

- Frontend UI and workflows live in this repository.
- Report generation API logic lives in the `report-api` repository.
- Supabase schema, RLS, and policy changes should be stored as SQL references or migration drafts only.
- Sensitive exports and production data must stay outside Git.

## Codex Project Root Rules

- Open `F:\07_網站與專案\repair-form` when working on the formal frontend repo.
- Open `C:\Users\emily\OneDrive\文件\New project\report-api` when working on the formal report API repo.
- Treat `C:\Users\emily\OneDrive\文件\New project` as a temporary, reference, and staging workspace only.
- Do not treat `C:\Users\emily\OneDrive\文件\New project` as one complete project root.
- Only `C:\Users\emily\OneDrive\文件\New project\report-api` is a formal repo inside `New project`.
- Do not move files between these roots unless the user explicitly requests it.
- Confirm the target root before editing when the task mentions reports, API, Supabase SQL, frontend UI, or GitHub Pages.

## Change Workflow

1. Read the relevant files before editing.
2. Confirm whether the change is frontend, report API, Supabase SQL, or documentation.
3. Keep edits scoped to the requested behavior.
4. Avoid broad refactors unless required to safely complete the task.
5. Test the affected workflow manually after changes.
6. Record security, SQL, API, or workflow changes in the appropriate docs folder.

## Required Modification Procedure

Use this procedure for every future code or SQL change unless the user explicitly says the task is documentation-only.

1. Confirm the requirement and the intended outcome.
2. Run `git status` in the affected repo before editing.
3. Keep the modification small and limited to necessary files.
4. Test locally or verify the affected workflow.
5. Update the relevant documentation or change record.
6. Split commits by purpose, such as UI, API, SQL, reports, or docs.
7. Push only after confirming the commit scope is clean.
8. Verify the production page, Render deploy, or Supabase result after deployment.

Do not mix unrelated changes in one commit. If existing uncommitted changes are present, preserve them and avoid overwriting user work.

## Git Workflow

- Work from `main` only for small documentation-only updates.
- Use a feature branch for functional changes.
- Commit messages should describe user-visible behavior or operational purpose.
- Push only after checking `git status` and confirming no unrelated files are included.
- Do not commit generated customer reports or production data snapshots.

## Branch Naming

- `docs/<topic>` for documentation-only changes.
- `feature/<short-name>` for new frontend behavior.
- `fix/<short-name>` for bug fixes.
- `sql/<short-name>` for Supabase SQL drafts or policy changes.
- `report/<short-name>` for report export related coordination.
- `staging/<short-name>` for temporary validation work.

Examples:

- `docs/ai-development-rules`
- `fix/invoice-filter-navigation`
- `sql/activity-log-select-policy`
- `report/dispatch-date-status-overview`

## Backup SOP

1. Before SQL changes, export or capture the current table grants and policies.
2. Store SQL backups or audit outputs in `SQL_Backup/`.
3. Name backup files with date and purpose, for example `2026-05-16_rls_before_hotfix.sql`.
4. Keep customer Excel exports outside the repository.
5. If a rollback is needed, use the paired rollback SQL instead of manually recreating old permissions.

## Staging SOP

1. Place temporary validation notes, screenshots, or staging-only checklists in `Staging/`.
2. Validate changes against a non-production dataset whenever possible.
3. For frontend changes, verify the local file or GitHub Pages page with a hard refresh.
4. For report API changes, confirm Render deployment status before testing downloads.
5. Remove temporary staging notes once the change is verified or archive them with a date.

## Documentation Map

- `docs/api/`: API behavior, request/response notes, error handling rules.
- `docs/sql/`: Supabase schema, RLS, grants, migration notes, rollback references.
- `docs/workflow/`: user workflows, Git workflow, deployment steps, operational SOPs.
- `docs/report/`: weekly/monthly report rules, Excel export logic, report validation notes.
- `Prompt_Template/`: reusable AI prompts for safe development tasks.
- `SQL_Backup/`: SQL audit outputs, rollback drafts, and database change backups.
- `Staging/`: temporary validation material before production use.
