# UI Implementation Rules

This document defines MVP UI implementation rules for the customer service record system.

It applies to future frontend work, including LINE import UI. It is a documentation-only rule set and does not change existing functionality.

## 1. MVP UI Development Principles

MVP UI work should be practical, small, and testable.

Rules:

- Build the smallest usable workflow first.
- Keep changes scoped to the requested feature.
- Prefer clear tables, filters, forms, and modals over complex new layouts.
- Avoid hidden automation for critical actions.
- Require operator confirmation before creating or linking cases.
- Keep data mutations auditable through `activity_log`.

## 2. Preserve Existing UI Style

The current system is an operational dashboard.

Preserve:

- Dark dashboard style.
- Compact table-first layout.
- Existing badge language and density.
- Existing button rhythm and spacing.
- Existing modal/drawer behavior where practical.
- Existing field labels and terminology.

Avoid:

- Marketing-style pages.
- Large decorative sections.
- Unrelated color palette changes.
- Full redesigns during MVP feature work.

## 3. No Large Refactors

MVP UI implementation must not include broad refactors unless explicitly approved.

Rules:

- Do not rewrite unrelated modules.
- Do not rename existing files unless required and approved.
- Do not change established data flow when a local addition is enough.
- Do not combine UI feature work with cleanup commits.
- Keep commits focused and reviewable.

## 4. Do Not Modify Auth

Authentication and authorization behavior must stay unchanged unless the user explicitly requests auth work.

Rules:

- Do not change API keys.
- Do not change Supabase auth behavior.
- Do not add login assumptions.
- Do not bypass RLS.
- Do not expose service role secrets in frontend code.

## 5. Do Not Directly Operate Production API

UI development must not directly operate production-only API or production data during early implementation.

Rules:

- Use staging or review-only workflows before production.
- Do not execute production SQL from frontend development.
- Do not test destructive operations on production.
- Do not upload real customer data into test screens.
- Do not call production report or import APIs for experiments unless approved.

## 6. `line-import` UI Development Scope

MVP scope for LINE import UI:

- `/line-import` page or equivalent tab.
- CSV upload panel.
- Manual paste panel.
- Import preview.
- Pending message list.
- Message detail modal or drawer.
- Create case action using existing case workflow.
- Link case action.
- Archive action.
- Error review.
- Duplicate warning.
- Status badge display.
- `activity_log` integration points.

Out of scope for MVP:

- LINE API.
- Browser Automation.
- AI auto-create case.
- Attachment handling.
- Auth redesign.
- Production data cleanup.

## 7. Component Naming Rules

Use names that describe the user workflow clearly.

Recommended component or function naming:

- `LineImportPage`
- `LineCsvUploadPanel`
- `LineManualPastePanel`
- `LineImportPreviewTable`
- `LinePendingMessageList`
- `LineMessageDetailDrawer`
- `LineMessageStatusBadge`
- `LineDuplicateWarning`
- `LineCreateCaseAction`
- `LineLinkCaseAction`

Rules:

- Prefix LINE import UI pieces with `Line`.
- Use nouns for components.
- Use verbs for actions.
- Avoid generic names such as `Panel1`, `DataBox`, or `NewModal`.
- Follow existing file and module style if the project already has a local convention.

## 8. Status Badge Rules

Supported LINE message statuses:

- `pending`
- `classified`
- `linked`
- `archived`
- `error`

Recommended labels:

| Status | Label | Meaning |
| --- | --- | --- |
| `pending` | 待分類 | Imported and waiting for review. |
| `classified` | 已分類 | Classified but not linked. |
| `linked` | 已連結 | Linked to a case or converted into a case. |
| `archived` | 已封存 | No active action required. |
| `error` | 需處理 | Import or parsing problem. |

Badge behavior:

- Badges must be readable in tables and detail views.
- Status color must be consistent across the page.
- `error` must be visually distinct.
- `linked` should show the linked `case_id` nearby when available.

## 9. Error Handling Rules

Every UI workflow must handle errors visibly and safely.

Required states:

- CSV parse failed.
- File type unsupported.
- Required fields missing.
- Manual paste parse uncertain.
- Duplicate detected.
- Supabase insert failed.
- Supabase update failed.
- RLS or permission denied.
- Network unavailable.

Rules:

- Show operator-friendly error messages.
- Do not expose API secrets, stack traces, or raw internal errors.
- Keep valid rows usable when only some rows fail.
- Show row-level error reasons in preview tables.
- Offer retry or correction when possible.

## 10. Loading State Rules

Every async action needs a loading state.

Required loading states:

- Reading CSV.
- Parsing pasted text.
- Checking duplicates.
- Importing rows.
- Loading pending messages.
- Creating case.
- Linking case.
- Archiving message.
- Writing activity log.

Rules:

- Disable repeated submit while loading.
- Keep the current screen stable.
- Show progress summary for batch imports when possible.
- Do not clear operator input until success is confirmed.

## 11. Duplicate Warning UI Rules

Duplicate warnings should appear before import confirmation and in review lists.

Warning types:

- `duplicate`: exact duplicate found by `duplicate_hash`.
- `possible_duplicate`: similar sender/time/message.
- `hash_missing`: cannot reliably check duplicate because `duplicate_hash` is null.

Rules:

- Exact duplicates should be skipped.
- `hash_missing` rows should require review or enter `error`.
- Warnings should be visible in the import preview.
- Import summary should show duplicate count.
- Duplicate handling should be logged in `activity_log`.

## 12. `activity_log` UI Rules

UI actions that mutate data must have matching activity log behavior.

Actions that require logging:

- CSV import completed.
- Manual paste import completed.
- Duplicate rows skipped.
- Import rows failed.
- Message classified.
- Message linked to case.
- Case created from LINE message.
- Message archived.
- Message error resolved.

UI behavior:

- Do not silently mutate `line_messages`.
- Show success summary after mutations.
- If `activity_log` write fails, show a warning and preserve the main operation result if already completed.
- Avoid storing full message text in `activity_log` when `line_messages` already stores it.

## 13. Staging First Principle

New UI workflows that depend on database schema must be validated against staging first.

Rules:

- SQL migration must be tested in staging before production.
- AI-generated UI changes must use staging data during validation when available.
- Do not point new import UI directly at production for first tests.
- Do not use real LINE chat exports in Git.
- Confirm staging rollback before production release.

## 14. Pre-Commit Checklist

Before committing UI work:

- Run `git status`.
- Confirm no unrelated files are included.
- Confirm no real customer data is included.
- Confirm no auth behavior was changed.
- Confirm no production-only endpoint was introduced for testing.
- Confirm loading and error states exist for async actions.
- Confirm duplicate warnings are handled.
- Confirm `activity_log` touchpoints are documented or implemented.
- Confirm UI style matches the existing system.
- Confirm staging validation notes are recorded when database behavior is involved.

## 15. Rollout Principles

Roll out MVP UI in small, reversible steps.

Recommended rollout:

1. Add documentation and SQL staging migration.
2. Validate staging schema.
3. Build UI behind a limited entry point.
4. Test with anonymized data.
5. Confirm duplicate and error behavior.
6. Confirm `activity_log` behavior.
7. Review with the user before production use.
8. Push and deploy only after approval.

Rollout rules:

- Prefer feature slices over large releases.
- Keep LINE import separate from unrelated UI fixes.
- Do not mix production migration execution with UI code commits.
- Keep rollback notes ready for database changes.
- Keep production workflow stable until staging passes.
