-- Purpose: store a separate explanation when cases.subcategory is "其他".
-- Apply this migration before deploying frontend code that writes subcategory_note.

begin;

alter table if exists public.cases
  add column if not exists subcategory_note text;

comment on column public.cases.subcategory_note is
  'Optional explanation used when category or subcategory is 其他.';

commit;

-- Rollback (run separately only when reverting this feature):
-- begin;
-- alter table if exists public.cases
--   drop column if exists subcategory_note;
-- commit;
