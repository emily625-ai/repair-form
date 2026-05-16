-- LINE messages MVP schema migration
-- Purpose:
--   Create public.line_messages for LINE OA CSV/manual-paste import staging.
--
-- Safety:
--   - This migration only creates a new table, constraints, indexes, and RLS shell.
--   - It does not modify existing tables.
--   - Review before execution.
--   - Do not execute from the repository automatically.

begin;

create extension if not exists pgcrypto;

create table if not exists public.line_messages (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  sender_name text,
  sender_id text,
  raw_message text not null,
  normalized_message text,
  received_at timestamptz,
  imported_at timestamptz not null default now(),
  status text not null default 'pending',
  case_id text,
  operator_id text,
  duplicate_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint line_messages_status_check
    check (status in ('pending', 'classified', 'linked', 'archived', 'error')),

  constraint line_messages_source_check
    check (source in ('csv', 'manual_paste', 'browser_automation'))
);

comment on table public.line_messages is
  'Imported LINE OA messages waiting for classification, case linking, or archiving.';

comment on column public.line_messages.raw_message is
  'Original imported message text. Preserve this value for audit and review.';

comment on column public.line_messages.normalized_message is
  'Cleaned message text used for search, classification, and duplicate checks.';

comment on column public.line_messages.duplicate_hash is
  'Optional stable duplicate detection key built from sender, received_at, source, and normalized content.';

comment on column public.line_messages.case_id is
  'Reserved relation to public.cases.id after a LINE message is linked or converted into a case.';

-- Index plan
create unique index if not exists line_messages_duplicate_hash_uidx
  on public.line_messages (duplicate_hash)
  where duplicate_hash is not null;

create index if not exists line_messages_received_at_idx
  on public.line_messages (received_at);

create index if not exists line_messages_status_idx
  on public.line_messages (status);

create index if not exists line_messages_case_id_idx
  on public.line_messages (case_id);

create index if not exists line_messages_status_received_at_idx
  on public.line_messages (status, received_at);

-- Keep RLS enabled from the start.
alter table public.line_messages enable row level security;

-- RLS policy recommendations:
--   MVP policy should be finalized before production use.
--   Do not add an Allow all policy.
--   Recommended future direction:
--     select: authorized operators only
--     insert: approved import workflow or authenticated operators only
--     update: authorized operators only for status/classification/link/archive actions
--     delete: service/admin only, or no client-side delete
--
-- Example policy shell, intentionally commented out:
--
-- create policy "line_messages_select_authenticated"
-- on public.line_messages
-- for select
-- to authenticated
-- using (true);
--
-- create policy "line_messages_insert_authenticated"
-- on public.line_messages
-- for insert
-- to authenticated
-- with check (true);
--
-- create policy "line_messages_update_authenticated"
-- on public.line_messages
-- for update
-- to authenticated
-- using (true)
-- with check (true);

commit;

-- Rollback SQL
-- Review and execute manually if this migration needs to be reverted.
--
-- begin;
--
-- drop policy if exists "line_messages_select_authenticated" on public.line_messages;
-- drop policy if exists "line_messages_insert_authenticated" on public.line_messages;
-- drop policy if exists "line_messages_update_authenticated" on public.line_messages;
--
-- drop index if exists public.line_messages_status_received_at_idx;
-- drop index if exists public.line_messages_case_id_idx;
-- drop index if exists public.line_messages_status_idx;
-- drop index if exists public.line_messages_received_at_idx;
-- drop index if exists public.line_messages_duplicate_hash_uidx;
--
-- drop table if exists public.line_messages;
--
-- commit;
