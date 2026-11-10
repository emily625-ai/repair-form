-- Rollback for 2026-11-10_inventory_moves_edit_week.sql（恢復成只能改／刪當天）
drop policy if exists inv_moves_update on public.inv_moves;
drop policy if exists inv_moves_delete on public.inv_moves;
create policy inv_moves_update on public.inv_moves for update to authenticated
  using (public.inv_is_admin()
         or (created_by = auth.uid() and move_date = (now() at time zone 'Asia/Taipei')::date))
  with check (public.inv_is_admin()
         or (created_by = auth.uid() and move_date = (now() at time zone 'Asia/Taipei')::date));
create policy inv_moves_delete on public.inv_moves for delete to authenticated
  using (public.inv_is_admin()
         or (created_by = auth.uid() and move_date = (now() at time zone 'Asia/Taipei')::date));
