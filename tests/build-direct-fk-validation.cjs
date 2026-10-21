const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'../docs/sql/line-conversations');
const schema='codex_line_direct_validation';
let sql=`begin;
create schema ${schema};
create table ${schema}.line_messages(id uuid primary key default gen_random_uuid(),source text,sender_id text,sender_name text,raw_message text,normalized_message text,received_at timestamptz,status text default 'pending',case_id text,duplicate_hash text,conversation_id uuid);
create table ${schema}.line_conversations(id uuid primary key default gen_random_uuid(),source text,sender_id text,sender_name text,started_at timestamptz,last_message_at timestamptz,message_count integer default 0,combined_message text,status text default 'pending_review',primary_case_id text,created_at timestamptz default now(),updated_at timestamptz default now());
create table ${schema}.cases(id text primary key,description text,new_product text,new_category text,new_subcategory text,case_nature text,classification_status text,classification_version text,classification_code text,project_name text,classification_note text);
create table ${schema}.activity_log(case_id text,action text,changed_by text,changed_at timestamptz,detail text);
alter table ${schema}.line_messages add foreign key(conversation_id) references ${schema}.line_conversations(id);
`;
for (const name of ['direct-fk-grouping-draft.sql','direct-fk-actions-draft.sql']) sql+=fs.readFileSync(path.join(dir,name),'utf8').replace(/^begin;|^commit;/gm,'').replaceAll('public.',schema+'.').replaceAll('pg_catalog,public','pg_catalog,'+schema);
sql+=`select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
grant usage on schema ${schema} to authenticated;
grant select,insert,update on all tables in schema ${schema} to authenticated;
alter table ${schema}.line_messages enable row level security;
alter table ${schema}.line_conversations enable row level security;
alter table ${schema}.activity_log enable row level security;
create policy fixture_messages on ${schema}.line_messages to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy fixture_conversations on ${schema}.line_conversations to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy fixture_audit on ${schema}.activity_log to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
set local search_path=${schema},public,pg_catalog;
do $$ declare a uuid; b uuid; c record; r jsonb; old_id uuid; begin
-- Legacy row inserted with triggers disabled solely in this disposable test schema.
alter table ${schema}.line_messages disable trigger user;
insert into line_messages(source,sender_id,raw_message,received_at) values('manual_paste','legacy','historical','2026-10-01T00:00Z') returning id into old_id;
alter table ${schema}.line_messages enable trigger user;
set local role authenticated;
r:=line_import_messages('[{"source":"manual_paste","sender_id":"A","raw_message":"first","received_at":"2026-10-05T00:00Z"},{"source":"manual_paste","sender_id":"A","raw_message":"second","received_at":"2026-10-05T00:05Z"}]');
select conversation_id into a from line_messages where raw_message='first';
if (select conversation_id from line_messages where raw_message='second')<>a then raise exception '5-minute grouping'; end if;
insert into line_messages(source,sender_id,raw_message,received_at) values('manual_paste','A','sliding','2026-10-05T00:34Z');
if (select conversation_id from line_messages where raw_message='sliding')<>a then raise exception 'Sliding window'; end if;
insert into line_messages(source,sender_id,raw_message,received_at) values('manual_paste','A','gap35','2026-10-05T01:09Z') returning conversation_id into b;
if a=b then raise exception '35-minute separation'; end if;
insert into line_messages(source,sender_id,raw_message,received_at) values('manual_paste','B','different','2026-10-05T01:09Z');
if (select conversation_id from line_messages where raw_message='different')=b then raise exception 'Sender isolation'; end if;
insert into line_messages(source,raw_message,received_at) values('line_webhook','{"source":{"groupId":"G"},"text":"one"}','2026-10-05T00:00Z'),('line_webhook','{"source":{"groupId":"G"},"text":"two"}','2026-10-05T00:05Z');
if (select count(distinct conversation_id) from line_messages where source='line_webhook')<>1 then raise exception 'Stable fallback'; end if;
insert into line_messages(source,raw_message,received_at) values('manual_paste','unknown1','2026-10-05T00:00Z'),('manual_paste','unknown2','2026-10-05T00:05Z');
if (select count(distinct conversation_id) from line_messages where raw_message like 'unknown%')<>2 then raise exception 'Missing ID isolation'; end if;
r:=line_import_messages('[{"source":"manual_paste","sender_id":"A","raw_message":"first","received_at":"2026-10-05T00:00Z"}]');
if r->>'duplicates'<>'1' then raise exception 'Duplicate skip'; end if;
if exists(select 1 from cases) then raise exception 'Automatic case creation'; end if;
insert into line_messages(source,sender_id,raw_message,received_at,status) values
 ('line_webhook','mixed-media','synthetic text','2026-10-05T02:00Z','pending'),
 ('line_webhook','mixed-media','{"message_type":"image","message_id":"synthetic-image"}','2026-10-05T02:05Z','error');
if (select count(distinct conversation_id) from line_messages where sender_id='mixed-media')<>1 then raise exception 'Mixed media grouping'; end if;
select * into c from line_conversation_queue where sender_id='mixed-media';
perform line_conversation_action(c.id,'archive',c.version,c.message_ids);
if (select count(*) from line_messages where sender_id='mixed-media' and status='archived')<>2 then raise exception 'Mixed media workflow'; end if;

if (select conversation_id from line_messages where id=old_id) is not null then raise exception 'Historical backfill'; end if;
select * into c from line_conversations where id=a;
if c.message_count<>3 or c.started_at<>'2026-10-05T00:00Z'::timestamptz or c.last_message_at<>'2026-10-05T00:34Z'::timestamptz or c.combined_message<>E'first\\nsecond\\nsliding' then raise exception 'Aggregate mismatch'; end if;
-- Latest frontend V3.1 tuples accepted; wrong project rejected before any case mutation.
select * into c from line_conversation_queue where id=b;
begin
 perform line_conversation_action(b,'create',c.version,c.message_ids,null,'{}',
 '{"id":"bad-project","classification_version":"v3_1_2026-10","classification_status":"confirmed","classification_code":"V3-0001","project_name":"wrong","new_product":"GPS","case_nature":"故障/異常","new_category":"GPS車機/通訊","new_subcategory":"GPS設備離線"}');
 raise exception 'Unexpected classification success';
exception when raise_exception then
 if sqlerrm<>'Active V3.1 classification tuple and project required' then raise; end if;
end;
if exists(select 1 from cases) then raise exception 'Rejected tuple created case'; end if;
-- Direct-FK split refreshes both aggregate snapshots without touching original text.
select * into c from line_conversation_queue where id=a;
perform line_conversation_action(a,'split',c.version,c.message_ids,null,array[(select id from line_messages where raw_message='second')]);
if (select message_count from line_conversations where id=a)<>2 then raise exception 'Split refresh'; end if;
select * into c from line_conversation_queue where id=a;
insert into cases(id,description) values('existing','original');
perform line_conversation_action(a,'merge',c.version,c.message_ids,'existing');
if (select status from line_conversations where id=a)<>'linked' then raise exception 'Merge'; end if;
select * into c from line_conversation_queue where id=b;
perform line_conversation_action(b,'archive',c.version,c.message_ids);
if (select status from line_conversations where id=b)<>'archived' then raise exception 'Archive'; end if;
select * into c from line_conversation_queue where source='line_webhook' limit 1;
perform line_conversation_action(c.id,'create',c.version,c.message_ids,null,'{}',
 '{"id":"new-v31-case","classification_version":"v3_1_2026-10","classification_status":"confirmed","classification_code":"V3-0001","project_name":"FMS","new_product":"GPS","case_nature":"故障/異常","new_category":"GPS車機/通訊","new_subcategory":"GPS設備離線"}');
if not exists(select 1 from cases where id='new-v31-case' and classification_code='V3-0001') then raise exception 'V3.1 manual create'; end if;
if (select raw_message from line_messages where id=old_id)<>'historical' or (select count(*) from cases)<>2 then raise exception 'Data preservation'; end if;
end $$;
reset role;
revoke insert on ${schema}.activity_log from authenticated;
set local role authenticated;
do $$ begin
 begin
  insert into line_messages(source,sender_id,raw_message,received_at) values('manual_paste','audit-test','must rollback','2026-10-05T00:00Z');
  raise exception 'Expected denied audit';
 exception when insufficient_privilege then null;
 end;
 if exists(select 1 from line_messages where sender_id='audit-test') or exists(select 1 from line_conversations where sender_id='audit-test') then raise exception 'Audit denial left data'; end if;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','${schema}.line_conversation_queue','SELECT') then raise exception 'Anon queue access'; end if;
 if has_function_privilege('anon','${schema}.line_import_messages(jsonb)','EXECUTE') then raise exception 'Anon import'; end if;
end $$;
select 'PASS: 5min,35min,different sender,stable fallback,missing ID,duplicate,no auto-case,sliding,aggregates,no backfill,split,merge,archive,raw preservation,authenticated RLS,audit rollback' as result;
rollback;
`;
fs.writeFileSync(process.argv[2]||'/tmp/direct-fk-validation.sql',sql);
console.log('Generated rollback-only validation; no production changes.');
