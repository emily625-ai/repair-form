-- RLS convergence: authenticated operators only
-- Purpose:
--   Tighten public Supabase access for the customer service record system after
--   the frontend login gate is available.
--
-- Target tables:
--   public.cases
--   public.activity_log
--   public.line_messages
--
-- Safety:
--   - Review before execution.
--   - Run audit SQL first and save the output.
--   - Test in staging or a copied project before production.
--   - Do not execute from the repository automatically.
--   - This does not modify auth settings.
--   - This does not modify table columns.
--   - This does not create delete access for anon/authenticated users.

-- ============================================================================
-- 0. Pre-migration audit
-- ============================================================================
-- Save this output before applying the migration.

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename in ('cases', 'activity_log', 'line_messages')
order by tablename, policyname;

select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('cases', 'activity_log', 'line_messages')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- ============================================================================
-- 1. Migration
-- ============================================================================

do $$
begin
  if to_regclass('public.cases') is null then
    raise exception 'Preflight failed: public.cases does not exist';
  end if;

  if to_regclass('public.activity_log') is null then
    raise exception 'Preflight failed: public.activity_log does not exist';
  end if;

  if to_regclass('public.line_messages') is null then
    raise exception 'Preflight failed: public.line_messages does not exist';
  end if;
end $$;

begin;

-- Enable RLS on all frontend-exposed tables.
alter table if exists public.cases enable row level security;
alter table if exists public.activity_log enable row level security;
alter table if exists public.line_messages enable row level security;

-- Remove known broad or previous draft policies if they exist.
drop policy if exists "Allow all" on public.cases;
drop policy if exists "Allow all" on public.activity_log;
drop policy if exists "Allow all" on public.line_messages;

drop policy if exists "cases_select" on public.cases;
drop policy if exists "cases_insert" on public.cases;
drop policy if exists "cases_update" on public.cases;
drop policy if exists "cases_select_authenticated" on public.cases;
drop policy if exists "cases_insert_authenticated" on public.cases;
drop policy if exists "cases_update_authenticated" on public.cases;

drop policy if exists "activity_log_select" on public.activity_log;
drop policy if exists "activity_log_insert" on public.activity_log;
drop policy if exists "activity_log_select_authenticated" on public.activity_log;
drop policy if exists "activity_log_insert_authenticated" on public.activity_log;

drop policy if exists "line_messages_select_authenticated" on public.line_messages;
drop policy if exists "line_messages_insert_authenticated" on public.line_messages;
drop policy if exists "line_messages_update_authenticated" on public.line_messages;

-- Remove anonymous direct table access.
revoke all on table public.cases from anon;
revoke all on table public.activity_log from anon;
revoke all on table public.line_messages from anon;

-- Keep frontend operations available only after Supabase Auth login.
grant select, insert, update on table public.cases to authenticated;
grant select, insert on table public.activity_log to authenticated;
grant select, insert, update on table public.line_messages to authenticated;

-- Ensure client roles cannot delete records through PostgREST.
revoke delete on table public.cases from anon, authenticated;
revoke delete on table public.activity_log from anon, authenticated;
revoke delete on table public.line_messages from anon, authenticated;

-- Cases: operators can read, create, and update cases after login.
create policy "cases_select_authenticated"
on public.cases
for select
to authenticated
using (true);

create policy "cases_insert_authenticated"
on public.cases
for insert
to authenticated
with check (true);

create policy "cases_update_authenticated"
on public.cases
for update
to authenticated
using (true)
with check (true);

-- Activity log: operators can read and create log entries only.
create policy "activity_log_select_authenticated"
on public.activity_log
for select
to authenticated
using (true);

create policy "activity_log_insert_authenticated"
on public.activity_log
for insert
to authenticated
with check (true);

-- LINE messages: operators can read, import, classify, link, and archive.
-- Backend LINE webhook writes should continue using service_role credentials.
create policy "line_messages_select_authenticated"
on public.line_messages
for select
to authenticated
using (true);

create policy "line_messages_insert_authenticated"
on public.line_messages
for insert
to authenticated
with check (true);

create policy "line_messages_update_authenticated"
on public.line_messages
for update
to authenticated
using (true)
with check (true);

commit;

-- ============================================================================
-- 2. Post-migration verification
-- ============================================================================

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename in ('cases', 'activity_log', 'line_messages')
order by tablename, policyname;

select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('cases', 'activity_log', 'line_messages')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- Expected manual browser checks:
--   1. Logged out: page remains locked behind login.
--   2. Logged in: case list loads.
--   3. Logged in: create/edit case works.
--   4. Logged in: activity log loads and records changes.
--   5. Logged in: LINE import list loads and status updates save.
--   6. Render webhook can still insert LINE webhook messages.

-- ============================================================================
-- 3. Rollback SQL
-- ============================================================================
-- Review before use. Prefer restoring from the pre-migration audit output.
-- Use this rollback only if the authenticated workflow fails after migration.
--
-- begin;
--
-- drop policy if exists "cases_select_authenticated" on public.cases;
-- drop policy if exists "cases_insert_authenticated" on public.cases;
-- drop policy if exists "cases_update_authenticated" on public.cases;
-- drop policy if exists "activity_log_select_authenticated" on public.activity_log;
-- drop policy if exists "activity_log_insert_authenticated" on public.activity_log;
-- drop policy if exists "line_messages_select_authenticated" on public.line_messages;
-- drop policy if exists "line_messages_insert_authenticated" on public.line_messages;
-- drop policy if exists "line_messages_update_authenticated" on public.line_messages;
--
-- -- Emergency compatibility rollback for the previous frontend public-access model.
-- -- This intentionally restores broader anon access and should be temporary.
-- grant select, insert, update on table public.cases to anon, authenticated;
-- grant select, insert on table public.activity_log to anon, authenticated;
-- grant select, insert, update on table public.line_messages to anon, authenticated;
--
-- create policy "cases_select"
-- on public.cases
-- for select
-- to anon, authenticated
-- using (true);
--
-- create policy "cases_insert"
-- on public.cases
-- for insert
-- to anon, authenticated
-- with check (true);
--
-- create policy "cases_update"
-- on public.cases
-- for update
-- to anon, authenticated
-- using (true)
-- with check (true);
--
-- create policy "activity_log_select"
-- on public.activity_log
-- for select
-- to anon, authenticated
-- using (true);
--
-- create policy "activity_log_insert"
-- on public.activity_log
-- for insert
-- to anon, authenticated
-- with check (true);
--
-- create policy "line_messages_select"
-- on public.line_messages
-- for select
-- to anon, authenticated
-- using (true);
--
-- create policy "line_messages_insert"
-- on public.line_messages
-- for insert
-- to anon, authenticated
-- with check (true);
--
-- create policy "line_messages_update"
-- on public.line_messages
-- for update
-- to anon, authenticated
-- using (true)
-- with check (true);
--
-- commit;
