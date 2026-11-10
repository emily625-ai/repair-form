-- ============================================================
-- 總倉實體進出紀錄：建表、權限、品項清單
-- Supabase 專案：cs-system（與客服記錄系統共用登入）
-- 只新增 inv_ 開頭的表，不動客服系統既有的表
-- ============================================================

-- 1. 使用者名單：只有名單上的人能用
create table if not exists public.inv_members (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create or replace function public.inv_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.inv_members where user_id = auth.uid());
$$;

create or replace function public.inv_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.inv_members where user_id = auth.uid() and is_admin);
$$;

-- 2. 品項清單（登記時下拉選單用）
create table if not exists public.inv_items (
  code       text primary key,
  name       text not null,
  unit       text not null default 'PCS',
  category   text,
  sort       int,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. 進出紀錄
create table if not exists public.inv_moves (
  id              bigint generated always as identity primary key,
  move_date       date not null default ((now() at time zone 'Asia/Taipei')::date),
  item_code       text not null references public.inv_items(code) on update cascade,
  direction       text not null check (direction in ('進','出')),
  qty             numeric not null check (qty > 0),
  note            text,
  created_by      uuid not null default auth.uid() references auth.users(id),
  created_by_name text,
  created_at      timestamptz not null default now()
);
create index if not exists inv_moves_date on public.inv_moves (move_date desc, id desc);
create index if not exists inv_moves_item on public.inv_moves (item_code, move_date);

-- 4. 權限（RLS）
alter table public.inv_members enable row level security;
alter table public.inv_items   enable row level security;
alter table public.inv_moves   enable row level security;

create policy inv_members_select on public.inv_members for select to authenticated using (public.inv_is_member());
create policy inv_members_admin  on public.inv_members for all    to authenticated using (public.inv_is_admin()) with check (public.inv_is_admin());

create policy inv_items_select on public.inv_items for select to authenticated using (public.inv_is_member());
create policy inv_items_admin  on public.inv_items for all    to authenticated using (public.inv_is_admin()) with check (public.inv_is_admin());

create policy inv_moves_select on public.inv_moves for select to authenticated using (public.inv_is_member());
create policy inv_moves_insert on public.inv_moves for insert to authenticated
  with check (public.inv_is_member() and created_by = auth.uid());
-- 刪除：管理者可刪任何一筆；一般人員只能刪自己當天登記的
create policy inv_moves_delete on public.inv_moves for delete to authenticated
  using (public.inv_is_admin()
         or (created_by = auth.uid() and move_date = (now() at time zone 'Asia/Taipei')::date));

revoke all on public.inv_members, public.inv_items, public.inv_moves from anon;

-- 5. 品項清單：總倉盤點表上的 30 項
insert into public.inv_items (code, name, unit, category, sort) values
('820-YK-AD-AIR4F-RCA','航空母-DC+RCA-DVR用','PCS','DVR/儲存',1),
('P00-DVR-MR9504D-B3','DVR4路_MR9504-B3_基本型_不回傳','台','DVR/儲存',2),
('P00-TI-DVR-MR9704C','DVR_4路_通立_MR9704C-0G0不回傳','PCS','DVR/儲存',3),
('P00-TI-DVR-MR9704E','DVR_4路_通立_MR9704E(不回傳)','PCS','DVR/儲存',4),
('5600-074279-E','毫米波雷達-角雷達延長線(5米)','PCS','毫米波雷達',5),
('5600-1000-003','毫米波雷達-角雷達0','PCS','毫米波雷達',6),
('82T-1000-03','0.3M感溫頭_(不含感溫線)','PCS','溫度感測/冷鏈',7),
('82T-DS182P-06M-3','感溫線_ONE_WIRE_6M-(2P)拆卸式','PCS','溫度感測/冷鏈',8),
('82T-DS182P-15M-1','感溫線_ONE_WIRE_15M-(2P)拆卸式','PCS','溫度感測/冷鏈',9),
('820-1000-003-0','航空線材_3M','PCS','線材/電源/保險絲',10),
('820-1000-005-0','航空線材_5M','PCS','線材/電源/保險絲',11),
('820-1000-010-0','航空線材_10M','PCS','線材/電源/保險絲',12),
('820-1000-015-0','航空線材_15M','PCS','線材/電源/保險絲',13),
('82W-IFH0-003-0','保險絲座取電器_大-(紅色)','PCS','線材/電源/保險絲',14),
('82W-IFH0-004-0','保險絲座取電器_中-(紅色)','PCS','線材/電源/保險絲',15),
('82W-IFH0-005-0','保險絲座取電器_小-(紅色)','PCS','線材/電源/保險絲',16),
('P00-LCMP7CH4','七吋螢幕接4ch','台','螢幕',17),
('P00-YU701B-LCD','YU-701B 7吋 車用螢幕','PCS','螢幕',18),
('P00-03-PT27-TWN-436','UW1_R6801-外接GPS&無電池總成','台','車機/ADAS/記錄器',19),
('P00-03-PT33-EEA-201','EZ2_LTE_C1EUAP總成(V2.0)-康訊','台','車機/ADAS/記錄器',20),
('P00-B01-LR-720H','車用左右鏡頭B01(紅外線版)-720P','PCS','鏡頭/攝影機',21),
('P00-C03-REAR-720H','車用後鏡頭C03-720H','PCS','鏡頭/攝影機',22),
('P00-DGM5757886SVAT','DGM5757886SVAT(5-50MM)','PCS','鏡頭/攝影機',23),
('P00-HG-A-HXT-D406','鏡頭_安盛通_HXT-D406','PCS','鏡頭/攝影機',24),
('P00-HG-C-HXT-C301','鏡頭_鴻鑫泰_HXT-C301','PCS','鏡頭/攝影機',25),
('P00-HG-C-HXT-C302','鏡頭_鴻鑫泰_HXT-C302','PCS','鏡頭/攝影機',26),
('P00-HG-C-HXT-D412','鏡頭_鴻鑫泰_HXT-D412','PCS','鏡頭/攝影機',27),
('P00-HG-CT-C01-A96','鏡頭_嘉太_AHD-720P','PCS','鏡頭/攝影機',28),
('P00-HXT-CA302','鏡頭_鴻鑫泰-CA302-標清用','PCS','鏡頭/攝影機',29),
('P00-HXT-D412CA','鏡頭_鴻鑫泰-D412CA-標清用','PCS','鏡頭/攝影機',30)
on conflict (code) do nothing;

-- 6. 把你自己設成管理者（用客服系統同一個帳號登入）
insert into public.inv_members (user_id, display_name, is_admin)
select id, 'Emily', true from auth.users where email = 'emily625@msn.com'
on conflict (user_id) do nothing;
