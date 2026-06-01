-- Add survey tracking fields to customer service cases.
-- Do not run directly on production until reviewed/backed up.

begin;

alter table if exists public.cases
  add column if not exists survey_sent boolean not null default false,
  add column if not exists survey_replied boolean not null default false;

comment on column public.cases.survey_sent is 'Whether the satisfaction survey was sent for this case.';
comment on column public.cases.survey_replied is 'Whether a satisfaction survey reply was received for this case.';

commit;

-- Rollback:
-- begin;
-- alter table if exists public.cases
--   drop column if exists survey_replied,
--   drop column if exists survey_sent;
-- commit;
