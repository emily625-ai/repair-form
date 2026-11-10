-- Rollback for 2026-11-10_inventory_opening_safety.sql
drop view if exists public.inv_balance;
alter table public.inv_items
  drop column if exists opening_qty,
  drop column if exists opening_date,
  drop column if exists safety_qty;
