-- REVIEW DRAFT: extends the existing direct-FK schema; no historical UPDATE.
-- Apply only after staging validation; paired rollback: direct-fk-grouping-rollback.sql.
begin;
alter table public.line_conversations add column if not exists grouping_key text;
alter table public.line_conversations add column if not exists sealed boolean not null default false;
alter table public.line_conversations add column if not exists version bigint not null default 1;
create index if not exists line_conversations_group_latest on public.line_conversations(source,grouping_key,last_message_at desc);

create function public.line_grouping_key(p_sender text,p_raw text,p_id uuid) returns text
language plpgsql immutable security invoker set search_path=pg_catalog,public as $$
declare event jsonb; identity text; field text;
begin
 if nullif(btrim(p_sender),'') is not null then return 'sender:'||btrim(p_sender); end if;
 begin event := p_raw::jsonb; exception when invalid_text_representation then return 'message:'||p_id; end;
 foreach field in array array['groupId','roomId','userId'] loop
  if jsonb_typeof(event->'source'->field)='string' then
   identity:=nullif(btrim(event->'source'->>field),'');
   if identity is not null then return field||':'||identity; end if;
  end if;
 end loop;
 return 'message:'||p_id;
end $$;

-- One shared trigger path for manual imports and future LINE API INSERTs.
-- Global transaction lock prevents concurrent sends from creating two conversations.
create function public.line_group_new_message() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare c public.line_conversations; identity text;
begin
 if new.conversation_id is not null or new.case_id is not null or new.status not in ('pending','error') then
  raise exception 'New LINE messages must be unassigned and pending/error';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('line_conversations_v1',0));
 identity:=public.line_grouping_key(new.sender_id,new.raw_message,new.id);
 -- Exact duplicate hash is authoritative only when provided by the upstream source.
 -- Without it use sender/source + valid event time + exact raw content, never display name.
 if exists(select 1 from public.line_messages m where
  (new.duplicate_hash is not null and m.duplicate_hash=new.duplicate_hash)
  or (new.duplicate_hash is null and new.received_at is not null
   and identity not like 'message:%' and m.source=new.source
   and public.line_grouping_key(m.sender_id,m.raw_message,m.id)=identity
   and m.received_at=new.received_at and m.raw_message=new.raw_message)) then
  return null;
 end if;
 if new.received_at is not null then
  select * into c from public.line_conversations
   where source=new.source and grouping_key=identity
   order by last_message_at desc nulls last,created_at desc,id desc limit 1 for update;
  -- Inspect latest conversation first: never resurrect an older open thread.
  if c.sealed or c.status not in ('pending_review','pending','classified','error')
   or c.last_message_at is null or new.received_at<c.last_message_at
   or new.received_at>c.last_message_at+interval '30 minutes' then c:=null; end if;
 end if;
 if c.id is null then
  insert into public.line_conversations(source,sender_id,sender_name,grouping_key,started_at,last_message_at,
    message_count,combined_message,status)
   values(new.source,new.sender_id,new.sender_name,identity,new.received_at,new.received_at,0,'','pending_review') returning * into c;
 end if;
 new.conversation_id:=c.id;
 return new;
end $$;

create function public.line_refresh_conversation(p_id uuid) returns void
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 update public.line_conversations c set started_at=q.first_at,last_message_at=q.last_at,
  message_count=q.n,combined_message=q.transcript,updated_at=now(),version=c.version+1
 from (select min(received_at) first_at,max(received_at) last_at,count(*)::integer n,
  string_agg(raw_message,E'\n' order by received_at nulls last,id) transcript
  from public.line_messages where conversation_id=p_id) q where c.id=p_id;
 if not found then raise exception 'Conversation update unavailable'; end if;
end $$;
create function public.line_finish_new_message() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 perform public.line_refresh_conversation(new.conversation_id);
 insert into public.activity_log(case_id,action,changed_by,changed_at,detail)
 values(null,'LINE 對話串收件',coalesce(auth.uid()::text,'line_api'),now(),
  format('conversation=%s message=%s',new.conversation_id,new.id));
 return new;
end $$;
create trigger line_group_new_message before insert on public.line_messages
 for each row execute function public.line_group_new_message();
create trigger line_finish_new_message after insert on public.line_messages
 for each row execute function public.line_finish_new_message();

create function public.line_import_messages(p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item jsonb; inserted integer:=0; n integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)=0
  or jsonb_array_length(p_rows)>500 then raise exception 'Expected 1 to 500 messages'; end if;
 -- Stable chronological import order; arrival order is kept for missing timestamps.
 for item in select value from jsonb_array_elements(p_rows) with ordinality
  order by (value->>'received_at')::timestamptz nulls last,ordinality loop
  if jsonb_typeof(item->'raw_message') is distinct from 'string'
   or nullif(btrim(item->>'raw_message'),'') is null
   or coalesce(item->>'source','') not in ('csv','manual_paste','browser_automation','line_webhook') then
   raise exception 'Invalid message';
  end if;
  insert into public.line_messages(source,sender_id,sender_name,raw_message,normalized_message,received_at,duplicate_hash,status)
   values(item->>'source',item->>'sender_id',item->>'sender_name',item->>'raw_message',
    item->>'normalized_message',(item->>'received_at')::timestamptz,nullif(item->>'duplicate_hash',''),'pending');
  get diagnostics n=row_count; inserted:=inserted+n;
 end loop;
 return jsonb_build_object('inserted',inserted,'duplicates',jsonb_array_length(p_rows)-inserted);
end $$;

create view public.line_conversation_queue with (security_invoker=true) as
 select c.*,q.message_ids,q.has_missing_hash from public.line_conversations c
 join lateral (select array_agg(m.id order by m.received_at nulls last,m.id) message_ids,
  bool_or(m.duplicate_hash is null) has_missing_hash
  from public.line_messages m where m.conversation_id=c.id) q on cardinality(q.message_ids)>0;
-- Existing RLS and table grants are unchanged. No anon execution or DELETE grant.
revoke all on function public.line_grouping_key(text,text,uuid),public.line_group_new_message(),
 public.line_refresh_conversation(uuid),public.line_finish_new_message(),public.line_import_messages(jsonb) from public,anon;
grant execute on function public.line_grouping_key(text,text,uuid),public.line_group_new_message(),
 public.line_refresh_conversation(uuid),public.line_finish_new_message(),public.line_import_messages(jsonb) to authenticated,service_role;
revoke all on public.line_conversation_queue from public,anon,authenticated;
grant select on public.line_conversation_queue to authenticated,service_role;
commit;
