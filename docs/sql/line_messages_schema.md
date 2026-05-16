# line_messages Schema

## Purpose

`line_messages` stores LINE Official Account chat messages imported by CSV or manual paste before they are classified, linked, archived, or converted into customer service cases.

This table is part of the LINE import MVP design. It does not modify existing tables.

## Table

```sql
public.line_messages
```

## Columns

| Column | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Yes | `gen_random_uuid()` | Primary key for each imported LINE message. |
| `source` | `text` | Yes | None | Import source, such as `csv`, `manual_paste`, or future `browser_automation`. |
| `sender_name` | `text` | No | None | Display name from LINE or manually parsed sender name. |
| `sender_id` | `text` | No | None | Optional stable sender identifier. |
| `raw_message` | `text` | Yes | None | Original imported message text. Must be preserved. |
| `normalized_message` | `text` | No | None | Cleaned message used for search, classification, and duplicate checks. |
| `received_at` | `timestamptz` | No | None | Time the message was received in LINE. |
| `imported_at` | `timestamptz` | Yes | `now()` | Time the message was imported into this system. |
| `status` | `text` | Yes | `pending` | Message workflow status. |
| `case_id` | `text` | No | None | Reserved relation to `cases.id` after linking or case creation. |
| `operator_id` | `text` | No | None | Operator who imported or processed the message. |
| `duplicate_hash` | `text` | No | None | Optional stable duplicate detection key. |
| `created_at` | `timestamptz` | Yes | `now()` | Row creation time. |
| `updated_at` | `timestamptz` | Yes | `now()` | Row update time. |

## Status Values

Allowed `status` values:

- `pending`
- `classified`
- `linked`
- `archived`
- `error`

Default status:

```sql
pending
```

## Duplicate Detection

`duplicate_hash` should be generated from a stable combination when enough sender, time, and message data is available:

```text
source + sender_id_or_sender_name + received_at + normalized_message
```

Duplicate detection rules:

- Same sender.
- Same received time.
- Same message content.

Recommended behavior:

- Create a partial unique index on `duplicate_hash` where `duplicate_hash is not null`.
- Skip duplicate rows during import.
- Log skipped duplicate counts to `activity_log`.
- Allow `duplicate_hash` to be null for rows that cannot be parsed reliably yet, such as manual paste rows in `error` status.

## Index Plan

Required MVP indexes:

- Partial unique index on `duplicate_hash` where `duplicate_hash is not null` to prevent duplicate imports while allowing uncertain rows.
- Index on `received_at` for date filtering and sorting.
- Index on `status` for pending pool filtering.
- Index on `case_id` for linked case lookup.

Optional later indexes:

- `(status, received_at)` for pending queue performance.
- `(source, imported_at)` for import history review.
- `sender_id` or `sender_name` if sender-based filtering becomes common.

## Reserved Relation

`case_id` is reserved for linking imported LINE messages to customer service cases.

MVP recommendation:

- Keep `case_id` as nullable text.
- Add an index on `case_id`.
- Add a foreign key only after confirming `cases.id` type and delete/update behavior.

Future relation option:

```sql
alter table public.line_messages
add constraint line_messages_case_id_fkey
foreign key (case_id)
references public.cases(id)
on update cascade
on delete set null;
```

## RLS Recommendation

Before production use:

- Enable RLS on `public.line_messages`.
- Do not use `Allow all` policies.
- Allow operators to read messages only when they are authorized to handle customer service data.
- Allow inserts only through approved import workflows.
- Allow updates only for controlled status changes, classification, linking, and archiving.
- Keep delete restricted.

Suggested policy direction:

- `select`: authorized operators only.
- `insert`: approved app role or authenticated operators only.
- `update`: authorized operators only, with allowed status transition checks if possible.
- `delete`: service/admin only, or no client-side delete.

## Rollback Requirement

Any migration that creates `line_messages` must include rollback SQL.

Rollback must remove:

- Table-level RLS policies.
- Indexes.
- The `line_messages` table.

Rollback must not affect existing tables such as `cases` or `activity_log`.
