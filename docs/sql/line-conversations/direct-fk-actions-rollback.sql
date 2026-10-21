begin;
drop function if exists public.line_conversation_action(uuid,text,bigint,uuid[],text,uuid[],jsonb);
commit;
-- Cases, messages, conversation metadata and activity logs are retained.
