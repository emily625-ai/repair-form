-- 2026-11-10 總倉進出紀錄：ERP 庫存匯入
-- 新增 inv_erp_stock：存放最近一次匯入的 ERP「倉庫存量表」（只存品號、品名、單位、在庫量，不存成本）
-- 每次匯入會整批取代；只有管理者能匯入，名單上的人都能看
-- 不影響客服系統既有的表
create table if not exists public.inv_erp_stock (
  code             text primary key,
  name             text not null,
  unit             text,
  qty              numeric,
  warehouse        text,
  data_date        date,
  imported_at      timestamptz not null default now(),
  imported_by_name text
);

alter table public.inv_erp_stock enable row level security;
create policy inv_erp_stock_select on public.inv_erp_stock for select to authenticated using (public.inv_is_member());
create policy inv_erp_stock_admin  on public.inv_erp_stock for all    to authenticated using (public.inv_is_admin()) with check (public.inv_is_admin());
revoke all on public.inv_erp_stock from anon;
