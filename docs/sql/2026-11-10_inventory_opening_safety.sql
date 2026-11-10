-- 2026-11-10 總倉進出紀錄：期初庫存、安全庫存、系統結存
-- inv_items 加上 期初數 / 期初日期 / 安全庫存
-- 期初＝115/11/06 總倉實盤（出貨後盤點、已複盤）；保險絲座取電器 3 項未盤，期初留空
-- 結存＝期初數 ＋ 期初日期「之後」的進 － 出（期初日當天的進出已含在盤點數內，不重複計算）
alter table public.inv_items
  add column if not exists opening_qty  numeric,
  add column if not exists opening_date date,
  add column if not exists safety_qty   numeric;

update public.inv_items i set opening_qty = v.q, opening_date = date '2026-11-06'
from (values
 ('820-YK-AD-AIR4F-RCA',53),('P00-DVR-MR9504D-B3',0),('P00-TI-DVR-MR9704C',0),('P00-TI-DVR-MR9704E',1),
 ('5600-074279-E',0),('5600-1000-003',0),('82T-1000-03',8),('82T-DS182P-06M-3',0),('82T-DS182P-15M-1',24),
 ('820-1000-003-0',30),('820-1000-005-0',0),('820-1000-010-0',8),('820-1000-015-0',19),
 ('P00-LCMP7CH4',0),('P00-YU701B-LCD',0),('P00-03-PT27-TWN-436',29),('P00-03-PT33-EEA-201',0),
 ('P00-B01-LR-720H',5),('P00-C03-REAR-720H',16),('P00-DGM5757886SVAT',0),('P00-HG-A-HXT-D406',28),
 ('P00-HG-C-HXT-C301',0),('P00-HG-C-HXT-C302',0),('P00-HG-C-HXT-D412',13),('P00-HG-CT-C01-A96',32),
 ('P00-HXT-CA302',0),('P00-HXT-D412CA',33)
) as v(code, q)
where i.code = v.code and i.opening_qty is null;

create or replace view public.inv_balance with (security_invoker = true) as
select i.code, i.name, i.unit, i.category, i.sort, i.active,
       i.opening_qty, i.opening_date, i.safety_qty,
       coalesce(sum(m.qty) filter (where m.direction = '進'), 0) as in_qty,
       coalesce(sum(m.qty) filter (where m.direction = '出'), 0) as out_qty,
       case when i.opening_qty is null then null
            else i.opening_qty + coalesce(sum(case when m.direction = '進' then m.qty else -m.qty end), 0) end as balance
from public.inv_items i
left join public.inv_moves m on m.item_code = i.code and i.opening_date is not null and m.move_date > i.opening_date
group by i.code;

revoke all on public.inv_balance from anon;
grant select on public.inv_balance to authenticated;
