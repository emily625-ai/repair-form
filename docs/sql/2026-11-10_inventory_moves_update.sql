-- 2026-11-10 總倉進出紀錄：開放修改進出紀錄
-- 規則同刪除：管理者可改任何一筆；一般帳號只能改自己當天登記的
-- 加上 updated_at / updated_by_name 記錄最後修改時間與修改人
alter table public.inv_moves
  add column if not exists updated_at      timestamptz,
  add column if not exists updated_by_name text;

create policy inv_moves_update on public.inv_moves for update to authenticated
  using (public.inv_is_admin()
         or (created_by = auth.uid() and move_date = (now() at time zone 'Asia/Taipei')::date))
  with check (public.inv_is_admin()
         or (created_by = auth.uid() and move_date = (now() at time zone 'Asia/Taipei')::date));
