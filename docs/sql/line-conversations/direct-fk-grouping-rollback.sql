-- Remove new behavior only; preserve conversation IDs, aggregates and all messages.
-- Before rollback restore the previous frontend and stop new LINE imports.
begin;
drop trigger if exists line_finish_new_message on public.line_messages;
drop trigger if exists line_group_new_message on public.line_messages;
drop view if exists public.line_conversation_queue;
drop function if exists public.line_import_messages(jsonb);
drop function if exists public.line_finish_new_message();
drop function if exists public.line_group_new_message();
drop function if exists public.line_refresh_conversation(uuid);
drop function if exists public.line_grouping_key(text,text,uuid);
drop index if exists public.line_conversations_group_latest;
-- Added metadata retained to preserve manual split/sealed boundaries and recovery.
commit;
