# LINE Import UI Specification

## 1. Page Structure: `/line-import`

The `/line-import` page is the MVP workspace for importing LINE Official Account messages into `line_messages`, reviewing pending messages, and creating or linking customer service cases.

The page must preserve the existing customer service system UI style:

- Dark operational dashboard layout.
- Compact but readable table-first workflow.
- Clear badges for status and warnings.
- No marketing-style screens.
- No changes to existing authentication behavior.
- No automatic case creation without operator confirmation.

Suggested top-level structure:

```text
Customer Service System
  ├─ Case List
  ├─ Analytics
  ├─ Activity Log
  └─ LINE Import
```

Suggested `/line-import` layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ LINE 訊息匯入                                                │
│ 匯入 LINE OA 訊息，先進待分類池，再建立或連結案件             │
├──────────────────────────────────────────────────────────────┤
│ [CSV Upload] [Manual Paste] [Pending Messages] [Linked]       │
├──────────────────────────────────────────────────────────────┤
│ Import Summary                                                │
│ Imported: 12 | Duplicates: 2 | Errors: 1 | Pending: 9          │
├──────────────────────────────────────────────────────────────┤
│ Main Panel                                                    │
│ - CSV upload panel, manual paste panel, or pending list        │
└──────────────────────────────────────────────────────────────┘
```

## 2. CSV Upload Block

Purpose:

- Import structured LINE OA chat records from CSV.
- Validate format before inserting rows into `line_messages`.
- Warn operators about duplicates before final import.

Required UI controls:

- Drag-and-drop upload area.
- File select button.
- Upload/preview button.
- Confirm import button after preview.
- Cancel/clear button.

Wireframe:

```text
┌──────────────────────────────────────────────────────┐
│ CSV 匯入                                             │
│ 拖拉 CSV 到這裡，或按「選擇檔案」                     │
│                                                      │
│ [選擇檔案] [預覽] [確認匯入] [清除]                  │
├──────────────────────────────────────────────────────┤
│ 格式檢查                                             │
│ required: received_at, sender_name/sender_id, message │
│                                                      │
│ Valid rows: 20 | Duplicates: 3 | Errors: 1            │
└──────────────────────────────────────────────────────┘
```

Format checks:

- `raw_message` or source message content must not be empty.
- At least one sender field should exist: `sender_name` or `sender_id`.
- `received_at` should be parseable when present.
- Unknown columns should not break import.
- Rows that cannot be parsed should be marked `error` or excluded with clear preview feedback.

Duplicate warning:

- Show duplicate count before import.
- Mark duplicate rows in preview.
- Explain that duplicates will be skipped.
- Duplicate detection uses `duplicate_hash` when available.
- Rows with null `duplicate_hash` cannot be reliably de-duplicated and should show a warning.

CSV preview columns:

- Row number
- Sender
- Message preview
- Received time
- Status
- Duplicate warning
- Error reason

## 3. Manual Paste Block

Purpose:

- Support LINE chat text pasted manually by an operator.
- Preserve original pasted text while allowing parsed preview before import.

Required UI controls:

- Large paste textarea.
- Parse/preview button.
- Confirm import button.
- Clear button.

Wireframe:

```text
┌──────────────────────────────────────────────────────┐
│ 手動貼上聊天文字                                     │
│ [textarea: paste LINE OA chat text here]              │
│                                                      │
│ [解析預覽] [確認匯入] [清除]                         │
├──────────────────────────────────────────────────────┤
│ 解析結果                                             │
│ Parsed: 8 | Needs review: 2 | Duplicates: 1           │
└──────────────────────────────────────────────────────┘
```

Preview parsing rules:

- Preserve pasted content in `raw_message`.
- Generate `normalized_message` for search and duplicate checks.
- Try to identify `sender_name`, `received_at`, and message body.
- Multiline messages should remain grouped when they belong to the same sender/time.
- Ambiguous rows should be shown as `error` or `needs review`.

Manual paste preview columns:

- Parsed sender
- Parsed received time
- Message preview
- Parse confidence
- Status
- Duplicate warning
- Error reason

## 4. Pending Message List

Purpose:

- Show imported LINE messages that are waiting for review, classification, linking, or archiving.

Required columns:

- `sender_name`
- Message preview
- `received_at`
- `status`
- Duplicate warning

Recommended columns:

- Source
- Linked case id
- Imported at
- Operator
- Actions

Wireframe:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Filters: Status | Source | Date range | Sender | Keyword | Duplicate only │
├─────────────┬──────────────────────┬────────────┬──────────┬──────────────┤
│ Sender      │ Message Preview      │ Received   │ Status   │ Warning      │
├─────────────┼──────────────────────┼────────────┼──────────┼──────────────┤
│ 王先生      │ 車機無法定位...       │ 2026-05-16 │ pending  │ -            │
│ 陳小姐      │ 登入失敗...           │ 2026-05-16 │ error    │ hash missing │
└─────────────┴──────────────────────┴────────────┴──────────┴──────────────┘
```

Row actions:

- View detail
- Classify
- Create case
- Link case
- Archive
- Resolve error

List behavior:

- Default filter should show `pending` and `error`.
- Linked and archived messages should be available through filters.
- Duplicate warning should be visible without opening detail.
- Rows with `error` should remain reviewable.

## 5. Message Detail Modal or Drawer

Purpose:

- Let operators inspect the full message before classification, linking, or case creation.

Recommended display:

```text
┌──────────────────────────────────────────────┐
│ LINE Message Detail                          │
├──────────────────────────────────────────────┤
│ Sender: 王先生                               │
│ Received: 2026-05-16 14:30                   │
│ Source: csv                                  │
│ Status: pending                              │
│ Duplicate: none                              │
├──────────────────────────────────────────────┤
│ Original Message                             │
│ raw_message                                  │
├──────────────────────────────────────────────┤
│ Normalized Message                           │
│ normalized_message                           │
├──────────────────────────────────────────────┤
│ Actions                                      │
│ [分類] [建立案件] [連結案件] [封存] [關閉]    │
└──────────────────────────────────────────────┘
```

Detail fields:

- `id`
- `source`
- `sender_name`
- `sender_id`
- `raw_message`
- `normalized_message`
- `received_at`
- `imported_at`
- `status`
- `case_id`
- `duplicate_hash`
- `operator_id`

## 6. Create Cases Workflow

The LINE import UI must not bypass the existing `cases` workflow.

Create case flow:

1. Operator opens a `pending` or `classified` LINE message.
2. Operator clicks `建立案件`.
3. System opens the existing case form in create mode.
4. System prefills available fields:
   - Channel: LINE or official LINE.
   - Problem description: `raw_message` or `normalized_message`.
   - Date/time: `received_at`.
   - Company/contact hint: `sender_name`.
5. Operator reviews and completes required fields.
6. Operator saves the case through the existing case creation logic.
7. System updates `line_messages.status = linked`.
8. System writes `line_messages.case_id`.
9. System writes required `activity_log` entries.

Link existing case flow:

1. Operator clicks `連結案件`.
2. System opens case search/select UI.
3. Operator selects existing `cases.id`.
4. System sets `case_id` and status `linked`.
5. System writes `activity_log`.

## 7. Status Badge Rules

Status badges should match the current operational style.

Recommended badge meanings:

| Status | Label | Meaning |
| --- | --- | --- |
| `pending` | 待分類 | Imported and waiting for review. |
| `classified` | 已分類 | Classified but not linked to a case. |
| `linked` | 已連結 | Linked to a case or created a case. |
| `archived` | 已封存 | No active action needed. |
| `error` | 需處理 | Import or parsing issue needs review. |

Visual rules:

- `pending`: neutral or blue.
- `classified`: purple or informational.
- `linked`: green.
- `archived`: gray.
- `error`: red or orange warning.

Badges should be readable in table rows and detail views.

## 8. Duplicate Warning UI

Duplicate warning should be visible in both preview and pending list.

Warning types:

- `duplicate`: exact duplicate found by `duplicate_hash`.
- `hash_missing`: duplicate hash is null, cannot reliably de-duplicate.
- `possible_duplicate`: same sender and similar message/time, but no exact hash match.

Suggested UI:

```text
[重複] Exact duplicate, skipped
[需確認] Missing duplicate hash
[可能重複] Similar sender/time/content
```

Behavior:

- Exact duplicates should be skipped during import.
- Missing hash rows may be imported as `error` or require operator confirmation.
- Possible duplicates should be shown for review before import.

## 9. Error Handling UI

Error states must be clear and operator-friendly.

Import-level errors:

- File cannot be read.
- CSV format cannot be parsed.
- Required columns are missing.
- Network or Supabase insert fails.
- RLS or permission failure.

Row-level errors:

- Empty message.
- Missing sender.
- Invalid timestamp.
- Duplicate hash cannot be generated.
- Unknown status or invalid source.

UI behavior:

- Show summary counts: imported, skipped, duplicate, error.
- Keep valid rows importable even when some rows fail.
- Show row-level error reason in preview.
- Do not expose secrets or raw stack traces.
- Offer retry after correction.

## 10. `activity_log` Flow

Every mutation must write `activity_log` when the existing workflow supports it.

Required event flow:

1. CSV preview or manual parse:
   - Optional log only if the system stores a server-side event.
2. Confirm CSV import:
   - `line_import_csv_completed`
3. Confirm manual paste import:
   - `line_import_manual_completed`
4. Duplicate rows skipped:
   - `line_import_duplicates_skipped`
5. Row errors:
   - `line_import_rows_failed`
6. Classification:
   - `line_message_classified`
7. Link to existing case:
   - `line_message_linked`
8. Create case from message:
   - `line_message_case_created`
9. Archive:
   - `line_message_archived`
10. Resolve error:
   - `line_message_error_resolved`

Recommended details:

- `line_message_id`
- `case_id`
- `source`
- `operator_id`
- `from_status`
- `to_status`
- `imported_count`
- `duplicate_count`
- `error_count`

## 11. Permission Requirements

Frontend requirements:

- Do not modify auth in MVP.
- Respect existing Supabase client setup.
- Do not add client-side delete unless explicitly approved.

Database requirements:

- `line_messages` must have RLS enabled before production use.
- No `Allow all` policy.
- Operators need read access to pending and assigned import rows.
- Operators need insert access only through approved import workflow.
- Operators need update access for status, classification, linking, and archiving.
- Delete should remain restricted to service/admin flows.

Operational requirements:

- CSV and pasted chat data must not be committed to Git.
- Use anonymized samples for testing.
- Any SQL policy change must have rollback SQL.

## 12. MVP and Future Expansion

MVP UI scope:

- `/line-import` page or equivalent tab.
- CSV upload panel.
- Manual paste panel.
- Import preview.
- Pending message list.
- Message detail modal/drawer.
- Classify action.
- Create case action.
- Link case action.
- Archive action.
- Duplicate warnings.
- Error handling UI.
- `activity_log` integration points.

Phase 2 candidates:

- AI-assisted classification suggestions.
- Batch classify.
- Browser Automation import.
- Sender-to-company matching.
- Similar case search.
- LINE-origin report metrics.
- Attachment support after storage/privacy review.

## 13. Existing UI Style Rules

The UI should feel like part of the current customer service system.

Rules:

- Preserve existing dark dashboard style.
- Preserve current table density and badge language.
- Use compact operational panels.
- Avoid decorative landing-page layouts.
- Avoid changing current case list, report, or activity log behavior.
- Keep labels clear and work-focused.
- Show warnings and errors near the affected rows.

This specification is documentation only. It does not start coding and does not modify existing functionality.
