-- Rollback for 2026-11-10_inventory_moves_update.sql
drop policy if exists inv_moves_update on public.inv_moves;
alter table public.inv_moves
  drop column if exists updated_at,
  drop column if exists updated_by_name;
