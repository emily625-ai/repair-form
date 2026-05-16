-- LINE messages MVP staging schema migration
-- Purpose:
--   Create staging.line_messages for LINE OA CSV/manual-paste import validation.
--
-- Safety:
--   - This migration targets the staging schema only.
--   - It does not create or modify public.line_messages.
--   - It does not modify existing production tables.
--   - Review before execution.
--   - Do not execute from the repository automatically.

begin;

create extension if not exists pgcrypto;

create schema if not exists staging;

create table if not exists staging.line_messages (
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

  constraint staging_line_messages_status_check
    check (status in ('pending', 'classified', 'linked', 'archived', 'error')),

  constraint staging_line_messages_source_check
    check (source in ('csv', 'manual_paste', 'browser_automation'))
);

comment on schema staging is
  'Pre-production validation schema for customer service system database changes.';

comment on table staging.line_messages is
  'Staging copy of LINE OA imported messages for migration and workflow validation.';

comment on column staging.line_messages.raw_message is
  'Original imported message text. Preserve this value for audit and review.';

comment on column staging.line_messages.normalized_message is
  'Cleaned message text used for search, classification, and duplicate checks.';

comment on column staging.line_messages.duplicate_hash is
  'Optional stable duplicate detection key built from sender, received_at, source, and normalized content.';

comment on column staging.line_messages.case_id is
  'Reserved relation to public.cases.id shape for staging validation only.';

-- Index plan
create unique index if not exists staging_line_messages_duplicate_hash_uidx
  on staging.line_messages (duplicate_hash)
  where duplicate_hash is not null;

create index if not exists staging_line_messages_received_at_idx
  on staging.line_messages (received_at);

create index if not exists staging_line_messages_status_idx
  on staging.line_messages (status);

create index if not exists staging_line_messages_case_id_idx
  on staging.line_messages (case_id);

create index if not exists staging_line_messages_status_received_at_idx
  on staging.line_messages (status, received_at);

-- Keep RLS enabled from the start for staging validation.
alter table staging.line_messages enable row level security;

-- RLS policy shell:
--   Policies are intentionally left commented for review.
--   Do not add an Allow all policy.
--   Test role access in staging before creating production policies.
--
-- create policy "staging_line_messages_select_authenticated"
-- on staging.line_messages
-- for select
-- to authenticated
-- using (true);
--
-- create policy "staging_line_messages_insert_authenticated"
-- on staging.line_messages
-- for insert
-- to authenticated
-- with check (true);
--
-- create policy "staging_line_messages_update_authenticated"
-- on staging.line_messages
-- for update
-- to authenticated
-- using (true)
-- with check (true);

commit;

-- Rollback SQL
-- Review and execute manually if this staging migration needs to be reverted.
-- This rollback only targets staging.line_messages and its staging objects.
--
-- begin;
--
-- drop policy if exists "staging_line_messages_select_authenticated" on staging.line_messages;
-- drop policy if exists "staging_line_messages_insert_authenticated" on staging.line_messages;
-- drop policy if exists "staging_line_messages_update_authenticated" on staging.line_messages;
--
-- drop index if exists staging.staging_line_messages_status_received_at_idx;
-- drop index if exists staging.staging_line_messages_case_id_idx;
-- drop index if exists staging.staging_line_messages_status_idx;
-- drop index if exists staging.staging_line_messages_received_at_idx;
-- drop index if exists staging.staging_line_messages_duplicate_hash_uidx;
--
-- drop table if exists staging.line_messages;
--
-- -- Keep the staging schema if other staging objects exist.
-- -- Drop it manually only after confirming it is empty and unused:
-- -- drop schema if exists staging;
--
-- commit;
