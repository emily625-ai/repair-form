-- Rollback for 2026-11-10_inventory_erp_stock.sql（只刪 ERP 匯入的快照，不影響進出紀錄與品項）
drop table if exists public.inv_erp_stock;
