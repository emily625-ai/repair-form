-- 2026-11-10 總倉進出紀錄：一般帳號可修改／刪除「自己一週內」登記的紀錄（原本只能當天）
-- 一週內＝紀錄日期在今天往前 7 天以內（台灣時間）；管理者不受限
drop policy if exists inv_moves_update on public.inv_moves;
drop policy if exists inv_moves_delete on public.inv_moves;

create policy inv_moves_update on public.inv_moves for update to authenticated
  using (public.inv_is_admin()
         or (created_by = auth.uid() and move_date >= (now() at time zone 'Asia/Taipei')::date - 7))
  with check (public.inv_is_admin()
         or (created_by = auth.uid() and move_date >= (now() at time zone 'Asia/Taipei')::date - 7
             and move_date <= (now() at time zone 'Asia/Taipei')::date));

create policy inv_moves_delete on public.inv_moves for delete to authenticated
  using (public.inv_is_admin()
         or (created_by = auth.uid() and move_date >= (now() at time zone 'Asia/Taipei')::date - 7));
