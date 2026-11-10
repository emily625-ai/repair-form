-- 2026-11-10 LINE 公司對應表 + line_messages 群組欄位
-- 已於 2026-11-10 由 Claude 透過 Supabase MCP 套用（migrations: create_line_sender_company, line_messages_add_group_fields）

-- ===== Forward =====
create table if not exists public.line_sender_company (
  sender_id text primary key,              -- LINE userId 或 groupId（看 key_type）
  company text,
  status text not null default 'auto' check (status in ('auto','conflict','confirmed','unknown')),
  source text not null default 'history' check (source in ('history','plate','manual')),
  alt_companies text,
  case_msg_count int default 0,
  note text,
  key_type text not null default 'user' check (key_type in ('user','group')),
  updated_at timestamptz not null default now()
);
alter table public.line_sender_company enable row level security;
create policy line_sender_company_select_authenticated on public.line_sender_company for select to authenticated using (true);
create policy line_sender_company_insert_authenticated on public.line_sender_company for insert to authenticated with check (true);
create policy line_sender_company_update_authenticated on public.line_sender_company for update to authenticated using (true);
-- 不開放 delete

alter table public.line_messages  add column if not exists group_id text, add column if not exists group_name text, add column if not exists source_type text;
alter table staging.line_messages add column if not exists group_id text, add column if not exists group_name text, add column if not exists source_type text;
create index if not exists line_messages_group_id_idx on public.line_messages(group_id);

-- 初始資料：依 line_messages.case_id → cases.company 的歷史對應自動帶入（多家公司時取次數最多者，標 conflict）

-- ===== Rollback =====
-- drop table if exists public.line_sender_company;
-- drop index if exists public.line_messages_group_id_idx;
-- alter table public.line_messages  drop column if exists group_id, drop column if exists group_name, drop column if exists source_type;
-- alter table staging.line_messages drop column if exists group_id, drop column if exists group_name, drop column if exists source_type;
