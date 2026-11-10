-- Rollback for 2026-11-10_inventory_moves.sql
-- 刪除總倉進出紀錄的 3 個表與 2 個函式（會一併刪除所有進出紀錄，執行前請先匯出 CSV 備份）
-- 不影響客服系統既有的表
drop table if exists public.inv_moves;
drop table if exists public.inv_members;
drop table if exists public.inv_items;
drop function if exists public.inv_is_member();
drop function if exists public.inv_is_admin();
