# LINE Import Feature Specification

## 1. Functional Goal

Build a LINE message import workflow for the customer service record system.

The first version does not use the LINE API. It supports LINE Official Account chat history imported by CSV or manually pasted text, then stores messages in a pending classification pool before converting them into customer service cases.

Main flow:

```text
LINE OA
  ↓
CSV / AI import
  ↓
line_messages
  ↓
Pending classification
  ↓
Create or link case
  ↓
Customer service system
```

Primary goals:

- Import LINE Official Account chat records without LINE API integration.
- Preserve original chat text for audit and review.
- Create a pending message pool before case creation.
- Support operator classification, case linking, archiving, and later AI-assisted classification.
- Ensure every import, classification, link, archive, and case creation action is traceable through `activity_log`.

Out of scope for MVP:

- LINE Messaging API integration.
- LINE Login or auth changes.
- Automatic LINE background sync.
- Attachment or image storage.
- Fully automatic case creation without operator review.

## 2. Supported Import Methods

MVP import methods:

- CSV import from exported or manually prepared LINE Official Account chat records.
- Manual paste from copied LINE chat text.

Future extension:

- Browser Automation import may be considered later for operator-assisted capture, but it must be reviewed separately for privacy, stability, and maintenance risk.

## 3. `line_messages` Table Schema

Suggested Supabase table:

```sql
public.line_messages
```

Detailed fields:

| Column | Suggested Type | Required | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key for each imported LINE message. |
| `source` | text | Yes | Import source: `csv`, `manual_paste`, `browser_automation`, or future source type. |
| `sender_name` | text | No | Display name from LINE chat or manually parsed sender name. |
| `sender_id` | text | No | Optional stable sender id. If unavailable, use a normalized local key later. |
| `raw_message` | text | Yes | Original imported message text. This must not be overwritten. |
| `normalized_message` | text | No | Cleaned text used for search, classification, or duplicate checks. |
| `received_at` | timestamptz | No | Time the message was received in LINE. |
| `imported_at` | timestamptz | Yes | Time the system imported the message. |
| `status` | text | Yes | Workflow status: `pending`, `classified`, `linked`, `archived`, or `error`. |
| `case_id` | text | No | Linked `cases.id` when the message is connected to a case. |
| `operator_id` | text | No | Operator who imported, classified, linked, or archived the message. |
| `duplicate_hash` | text | Yes | Stable hash used to avoid duplicate imports. |
| `created_at` | timestamptz | Yes | Row creation time. |
| `updated_at` | timestamptz | Yes | Last update time. |

Suggested constraints:

- `id` should default to a generated UUID.
- `status` should be constrained to known values.
- `duplicate_hash` should be unique when enough data exists to build a reliable hash.
- `case_id` should reference `cases.id` if the database relationship is safe to enforce.

Suggested future fields:

- `raw_payload` for source metadata from CSV parsing or Browser Automation.
- `classified_category` for proposed problem category.
- `classified_subcategory` for proposed problem subcategory.
- `classified_at` for classification timestamp.
- `linked_at` for case linking timestamp.

## 4. Duplicate Detection Rules

Duplicate detection should prevent repeated import of the same LINE message.

Base duplicate rule:

- Same sender.
- Same received time.
- Same message content.

Recommended `duplicate_hash` input:

```text
source + sender_id_or_sender_name + received_at + normalized_message
```

If `sender_id` is unavailable:

```text
source + normalized_sender_name + received_at + normalized_message
```

Normalization rules:

- Trim leading and trailing spaces.
- Normalize repeated whitespace for `normalized_message`.
- Preserve the original text in `raw_message`.
- Convert received time into a consistent ISO timestamp when possible.
- If timestamp parsing fails, import the row with `status = error` or require operator confirmation.

Duplicate handling:

- Exact duplicates should be skipped.
- Skipped rows should be counted in the import summary.
- Duplicate skips must write an `activity_log` event.
- The UI should show imported count, skipped duplicate count, and error count.

## 5. Status Flow

Allowed statuses:

- `pending`: Imported and waiting for review.
- `classified`: Operator or AI has classified the message, but it is not linked to a case.
- `linked`: Connected to an existing case or used to create a new case.
- `archived`: No case is needed, or the message is intentionally removed from active handling.
- `error`: Import or parsing failed and requires review.

Expected transitions:

```text
pending
  → classified
  → linked

pending
  → linked

pending
  → archived

pending
  → error

classified
  → linked

classified
  → archived

error
  → pending

error
  → archived
```

Notes:

- `linked` should usually be final.
- Reopening a `linked` message should require an explicit correction workflow.
- `archived` should be reversible only if the user explicitly chooses to restore it.
- `error` is for import failures, missing required fields, bad timestamps, or parsing ambiguity.

## 6. CSV Import Workflow

CSV import should be the first structured import path.

Suggested flow:

1. Operator opens LINE import panel.
2. Operator selects CSV file.
3. System previews parsed rows before final import.
4. System validates required fields.
5. System normalizes sender, timestamp, and message text.
6. System computes `duplicate_hash`.
7. System skips duplicates and flags invalid rows.
8. Operator confirms import.
9. System inserts valid rows into `line_messages` with `status = pending`.
10. System writes `activity_log` with imported, skipped, and error counts.

Suggested CSV columns:

- `received_at`
- `sender_name`
- `sender_id`
- `message`

CSV validation:

- `message` must not be empty.
- At least one of `sender_name` or `sender_id` should exist.
- `received_at` should be parsed when present.
- Unknown columns should be ignored or stored in future `raw_payload`.

Error handling:

- Invalid rows should not block valid rows.
- Each invalid row should be visible in preview.
- The operator should be able to download or review rejected rows later.

## 7. Manual Paste Workflow

Manual paste supports copied LINE chat text when no CSV is available.

Suggested flow:

1. Operator opens manual paste import.
2. Operator pastes raw LINE chat text.
3. System preserves full pasted content.
4. System tries to split messages by timestamp and sender pattern.
5. System previews parsed messages.
6. Operator corrects sender, timestamp, or message grouping if needed.
7. System computes `duplicate_hash`.
8. System inserts confirmed rows with `source = manual_paste` and `status = pending`.
9. System writes `activity_log` with import summary.

Manual paste rules:

- Preserve original pasted text in `raw_message`.
- Use `normalized_message` for search and duplicate checks.
- Multiline messages should remain one message when they belong to the same sender/time.
- If parsing is uncertain, mark the row `error` or require confirmation.

## 8. Future Browser Automation Workflow

Browser Automation is a Phase 2 or later enhancement.

Possible workflow:

1. Operator opens LINE OA chat screen manually.
2. Automation reads visible chat rows from the browser.
3. Operator confirms the captured range.
4. System converts captured rows into the same normalized import preview.
5. System runs duplicate detection.
6. System inserts confirmed rows into `line_messages`.
7. System writes `activity_log` with source `browser_automation`.

Required review before implementation:

- Confirm the automation does not store credentials.
- Confirm it does not bypass LINE or company security rules.
- Confirm captured data is limited to selected chat records.
- Confirm UI changes in LINE OA will not silently corrupt imports.
- Confirm operator must approve before insertion.

## 9. Case Creation Flow

Suggested workflow from LINE message to case:

1. Operator imports CSV or pasted chat text.
2. Messages enter `line_messages` with `status = pending`.
3. Operator reviews messages in the pending pool.
4. Operator classifies problem category and subcategory.
5. Operator chooses one action:
   - Link to existing case.
   - Create a new case.
   - Archive as no case needed.
6. When creating a new case, the form should prefill available fields:
   - Problem description from `raw_message` or `normalized_message`.
   - Company or contact hint from `sender_name`.
   - Received date from `received_at`.
   - Channel as LINE or official LINE.
7. Case creation must use the existing case numbering and validation rules.
8. After case creation, set `line_messages.status = linked` and store `case_id`.
9. Write `activity_log` for both the case creation and the LINE message link.

## 10. UI Wireframe Recommendations

Keep the existing dashboard style and operational density.

Suggested navigation:

```text
案件列表 | 分析報表 | 操作記錄 | LINE匯入
```

Suggested LINE import page layout:

```text
┌─────────────────────────────────────────────────────────┐
│ LINE 訊息匯入                                           │
│ [CSV匯入] [手動貼上] [待分類] [已連結] [封存]            │
├─────────────────────────────────────────────────────────┤
│ 篩選：狀態 / 來源 / 日期 / 發送者 / 關鍵字              │
├─────────────────────────────────────────────────────────┤
│ 訊息列表                                                │
│ 時間 | 發送者 | 訊息摘要 | 來源 | 狀態 | 案件 | 操作     │
├─────────────────────────────────────────────────────────┤
│ 右側或彈窗：分類、建立案件、連結案件、封存              │
└─────────────────────────────────────────────────────────┘
```

Suggested pending message columns:

- Received time
- Sender name
- Message preview
- Source
- Status
- Linked case id
- Actions

Suggested row actions:

- Classify
- Create case
- Link case
- Archive
- Mark error resolved

UI rules:

- Do not change the current visual style without explicit design work.
- Keep tables readable for long daily use.
- Use clear import summaries after each import.
- Show duplicate and error counts near the import result.
- Avoid exposing raw technical errors to operators.

## 11. `activity_log` Event Naming Rules

Use consistent action names with a `line_` prefix.

Recommended events:

| Event | When |
| --- | --- |
| `line_import_csv_started` | CSV import preview or processing starts. |
| `line_import_csv_completed` | CSV import finishes. |
| `line_import_manual_completed` | Manual paste import finishes. |
| `line_import_duplicates_skipped` | Duplicate rows are skipped. |
| `line_import_rows_failed` | Invalid rows are rejected or marked error. |
| `line_message_classified` | Operator classifies a message. |
| `line_message_linked` | Message is linked to an existing case. |
| `line_message_case_created` | New case is created from LINE message. |
| `line_message_archived` | Message is archived. |
| `line_message_error_resolved` | Error row is corrected and returned to workflow. |

Suggested `activity_log` details:

- `source`
- `line_message_id`
- `case_id`
- `operator_id`
- `imported_count`
- `duplicate_count`
- `error_count`
- `from_status`
- `to_status`

Do not store unnecessary full message content in `activity_log` if it already exists in `line_messages`.

## 12. Risks and Limitations

Operational risks:

- LINE export format may vary.
- Manual paste format may be inconsistent.
- Sender identity may be unclear without LINE API.
- Timestamp parsing may fail or use the wrong timezone.
- Duplicate detection may be imperfect when timestamp or sender is missing.
- AI classification can be wrong and must stay reviewable.

Security and privacy risks:

- LINE messages may contain personal data.
- `line_messages` needs RLS before production use.
- `DELETE` access should remain restricted.
- SQL migration must be independent and rollback-capable.
- CSV and pasted chat exports must not be committed to Git.
- Browser Automation must not store credentials or capture unrelated chats.

Technical limitations:

- MVP cannot guarantee official LINE sender identity.
- MVP does not handle attachments.
- MVP should not auto-create cases without operator confirmation.
- Browser Automation may break when LINE OA UI changes.

## 13. MVP and Phase 2 Plan

MVP scope:

- `line_messages` SQL migration draft.
- Rollback SQL for `line_messages`.
- RLS policy draft for `line_messages`.
- CSV import preview and validation design.
- Manual paste import preview and validation design.
- Pending message pool UI.
- Manual classification.
- Link to existing case.
- Create new case from selected message.
- Archive message.
- Required `activity_log` events.

MVP acceptance criteria:

- No LINE API is required.
- CSV and manual paste imports are supported by the design.
- Imported messages enter `pending` before case creation.
- Duplicate detection is defined and visible in import summary.
- Original message text is preserved.
- Every mutation writes `activity_log`.
- SQL migration is independent and rollback-capable before implementation.
- Existing UI style is preserved.

Phase 2 scope:

- AI-assisted classification suggestions.
- Batch classification.
- Browser Automation import research.
- Better sender matching with customer/company records.
- Message-to-case similarity search.
- Import error review dashboard.
- Optional attachment handling after storage and privacy design.
- Expanded report metrics for LINE-originated cases.

## 14. Future Development Steps

Recommended sequence:

1. Create SQL migration draft for `line_messages`.
2. Create paired rollback SQL.
3. Define RLS policies and grants for `line_messages`.
4. Document CSV field format in `docs/line-import/`.
5. Document manual paste parsing rules in `docs/line-import/`.
6. Build pending message pool UI.
7. Add import preview and validation.
8. Add classify, link, create case, archive, and error resolution actions.
9. Add required `activity_log` writes.
10. Test with anonymized sample LINE messages.
11. Document operator SOP in `docs/workflow/`.

Suggested file locations:

- SQL migration draft: `docs/sql/`.
- Rollback SQL draft: `SQL_Backup/` or `docs/sql/`.
- Import workflow SOP: `docs/workflow/`.
- UI implementation notes: `docs/line-import/`.
- Future AI prompt template: `Prompt_Template/`.
