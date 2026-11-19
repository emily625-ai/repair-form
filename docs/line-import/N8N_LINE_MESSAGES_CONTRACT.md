# Phase 0 Contract: n8n → line_messages Integration

> **Scope**: Defines exactly what n8n writes into `public.line_messages`, what it must never touch,
> and how the frontend reads that data. This document is the authoritative reference for both
> n8n workflow authors and frontend developers.

---

## 1. Golden Rule

n8n is a **silent intake worker only**.

| n8n CAN | n8n MUST NOT |
|---------|-------------|
| INSERT rows into `line_messages` with `status = 'pending'` | Write to `cases`, `activity_log`, or any other table |
| PATCH `line_messages` rows it owns (e.g. update `raw_message` before review) | Read or modify `cases` table |
| Read `line_messages` rows to detect duplicates before insert | Auto-create cases |
| Compute `duplicate_hash` before inserting | Send any message to users without human approval |

**Every case is created by a human** clicking "建立案件" in the frontend, never automatically.

---

## 2. Authentication: service_role Key

n8n uses the `service_role` key to bypass RLS and insert into `line_messages`.

| Rule | Detail |
|------|--------|
| Storage | n8n credential store only (on the local machine running n8n) |
| NEVER in Git | Any commit containing the service_role key must be reverted immediately |
| NEVER in frontend JS | Frontend uses `anon` key only; the service_role key must never appear in any `.js` or `.html` file in this repo |
| NEVER in logs | n8n workflows must not log the key value |
| Rotation | If accidentally exposed, rotate immediately in Supabase Dashboard → Settings → API |

The `anon` key in `客服記錄系統.data.js` is public by design and grants read/write to authenticated users only (RLS enforces this). It is NOT a substitute for the service_role key in n8n.

---

## 3. Table Schema

Target table: `public.line_messages`

```sql
id              uuid        PK, auto (gen_random_uuid())
source          text        NOT NULL — see allowed values §4
sender_name     text        nullable
sender_id       text        nullable — LINE user UID if available
raw_message     text        NOT NULL — original message, never modified after insert
normalized_message text     nullable — see §5
received_at     timestamptz nullable — when the LINE message was sent
imported_at     timestamptz NOT NULL default now() — set by DB, do not send
status          text        NOT NULL default 'pending' — always 'pending' on insert
case_id         text        nullable — leave NULL; frontend sets this when linking
operator_id     text        nullable — leave NULL on insert
duplicate_hash  text        nullable — see §5; enables unique dedup index
created_at      timestamptz NOT NULL default now() — set by DB, do not send
updated_at      timestamptz NOT NULL default now() — set by DB, do not send
```

---

## 4. Allowed Field Values

### `source`

The database has a CHECK constraint:

```sql
check (source in ('csv', 'manual_paste', 'browser_automation'))
```

n8n **must use `'browser_automation'`** for all automated LINE OA imports.
Inserting any other value will cause a 400 error from Supabase.

> If a new source type is needed (e.g. `line_webhook`), a database migration must be applied
> first to extend the CHECK constraint. Do NOT bypass by using an existing value that
> doesn't represent the actual source.

### `status`

Always `'pending'` on insert. Never send a different value.
Valid lifecycle values (set only by frontend/human action): `pending → classified → linked → archived → error`.

---

## 5. duplicate_hash Computation

The `duplicate_hash` field enables the database unique index to silently reject true duplicates on re-import.

### Formula

```
duplicate_hash = source + "|" + sender_key + "|" + received_at_utc + "|" + normalized_message
```

Where:
- **`source`**: same value as the `source` field (e.g. `browser_automation`)
- **`sender_key`**: `sender_id` if available, otherwise `sender_name` (prefer `sender_id`)
- **`received_at_utc`**: `received_at` as ISO 8601 in UTC, **seconds precision** (e.g. `2026-07-25T10:30:00Z`)
  - Do NOT include milliseconds; trim to `YYYY-MM-DDTHH:MM:SSZ`
- **`normalized_message`**: result of applying `normalize()` to `raw_message` (see below)

### normalize() — must match frontend exactly

```javascript
// Frontend reference (客服記錄系統.line-import.js, normalizeLineMessageText)
function normalize(message) {
  return String(message || '')
    .replace(/\s+/g, ' ')  // collapse all whitespace (including \n, \t, 　) to single space
    .trim()
    .toLowerCase();
}
```

In Python (n8n Code node):
```python
import re
def normalize(message):
    return re.sub(r'\s+', ' ', str(message or '')).strip().lower()
```

In n8n Expression:
```
{{ $json.raw_message.replace(/\s+/g, ' ').trim().toLowerCase() }}
```

### Example

| Field | Value |
|-------|-------|
| raw_message | `"GPS 訊號不見了\n\n請幫忙確認"` |
| normalized_message | `"gps 訊號不見了 請幫忙確認"` |
| source | `"browser_automation"` |
| sender_id | `"Uabc123def456"` |
| received_at (UTC) | `"2026-07-25T10:30:00Z"` |
| **duplicate_hash** | `"browser_automation\|Uabc123def456\|2026-07-25T10:30:00Z\|gps 訊號不見了 請幫忙確認"` |

If `sender_id` is empty, use `sender_name`:
```
"browser_automation|王大明|2026-07-25T10:30:00Z|gps 訊號不見了 請幫忙確認"
```

### Dedup behavior

The database has a partial unique index on `duplicate_hash WHERE duplicate_hash IS NOT NULL`.
On conflict, Supabase returns HTTP 409 or 400. n8n should treat this as success (not an error)
and log it as "already imported, skipped."

---

## 6. Minimum REST POST Example

```http
POST https://cbnrcwujxgopuglngdlb.supabase.co/rest/v1/line_messages
Content-Type: application/json
apikey: <service_role_key>
Authorization: Bearer <service_role_key>
Prefer: return=minimal

{
  "source": "browser_automation",
  "sender_name": "王大明",
  "sender_id": "Uabc123def456",
  "raw_message": "GPS 訊號不見了\n\n請幫忙確認",
  "normalized_message": "gps 訊號不見了 請幫忙確認",
  "received_at": "2026-07-25T10:30:00Z",
  "status": "pending",
  "duplicate_hash": "browser_automation|Uabc123def456|2026-07-25T10:30:00Z|gps 訊號不見了 請幫忙確認"
}
```

**Do NOT include**: `id`, `imported_at`, `created_at`, `updated_at`, `case_id`, `operator_id`.
These are set by the database.

Use `Prefer: return=minimal` (not `return=representation`) to minimize response payload in bulk imports.

On duplicate hash conflict, Supabase returns:
```json
{"code":"23505","details":"Key (duplicate_hash)=(...) already exists.","hint":null,"message":"duplicate key value violates unique constraint \"line_messages_duplicate_hash_uidx\""}
```
Treat HTTP 409 with code `23505` as a successful no-op skip.

---

## 7. Fields n8n May Omit

These fields can be omitted (will be NULL or use DB defaults):

| Field | When to omit |
|-------|-------------|
| `sender_id` | LINE OA does not always expose user UID in browser automation context |
| `sender_name` | Only omit if truly unknown; prefer including even just "未知" |
| `received_at` | Omit only if timestamp cannot be determined; frontend sorts by `created_at` as fallback |
| `normalized_message` | Frontend will derive it from `raw_message` if NULL, but prefer computing it in n8n |
| `duplicate_hash` | If omitted, dedup index is inactive for this row; frontend shows `hash_missing` warning |

**`raw_message` and `source` are always required.**

---

## 8. How the Frontend Interprets Each Row

The frontend function `mapLineMessageRecordToUiRow()` (in `客服記錄系統.line-import.js`) reads these
fields and derives the UI state:

| DB field | UI meaning |
|----------|-----------|
| `sender_name` | Displayed as LINE contact name |
| `sender_id` | Used for sender→company mapping (localStorage). If NULL, mapping feature is disabled |
| `raw_message` | Displayed verbatim in detail panel and pre-filled into case description |
| `normalized_message` | Used by keyword classification engine |
| `received_at` | Pre-filled as 進線日期時間 when creating a case |
| `duplicate_hash` presence + `sender_id` presence | Controls `duplicate_warning` badge:<br>• `sender_id` present → `none` (trusted import)<br>• hash present but no `sender_id` → `possible_duplicate`<br>• hash absent → `hash_missing` (shown in orange) |
| `status` | Controls which action buttons appear (pending/error → show 建立案件 button) |

---

## 9. Security Checklist Before Going Live

- [ ] service_role key stored only in n8n → Credentials section (encrypted at rest)
- [ ] No service_role key in any `.env`, `.js`, `.json`, or any file committed to Git
- [ ] n8n workflow tested with a single message before bulk run
- [ ] Duplicate hash verified: re-import of same message returns 409, not a new row
- [ ] Confirmed n8n has NO workflow node that writes to `cases` table
- [ ] Supabase Dashboard → Authentication → Policies confirms `line_messages` RLS is enabled

---

## 10. Out of Scope for Phase 0

These are planned for later phases and must NOT be implemented in Phase 0:

- n8n reading from `cases` table
- n8n writing `case_id` back to `line_messages` (that is a frontend action)
- n8n sending notifications or LINE replies
- Any auto-case-creation logic in n8n
- Webhook-based real-time ingestion (requires `line_webhook` source value + DB migration)
- n8n updating `status` beyond the initial `pending`
