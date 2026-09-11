-- SQL Editor: run the entire file AFTER 202609110001_friends.sql.
-- Disposable A/B/C fixtures. All writes roll back, including Auth users.
begin;
insert into auth.users(id,email_confirmed_at,raw_user_meta_data) values
 ('f1100000-0000-4000-8000-000000000001',now(),'{"nickname":"Friend test A"}'),
 ('f1100000-0000-4000-8000-000000000002',now(),'{"nickname":"Friend test B"}'),
 ('f1100000-0000-4000-8000-000000000003',now(),'{"nickname":"Friend test C"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000001',true);
insert into public.calendar_accounts(user_id,data) values(auth.uid(),'{"events":[
 {"id":"secret","title":"PRIVATE TITLE","date":"2026-09-01","time":"09:00","type":"personal"},
 {"id":"explicit-private","title":"PRIVATE NOTE","date":"2026-09-02","time":"09:00","type":"personal","visibility":"private"},
 {"id":"shared","title":"Public event","date":"2026-09-03","time":"09:00","type":"personal","visibility":"friends"},
 {"id":"group-secret","title":"GROUP SECRET","date":"2026-09-04","time":"09:00","type":"group","visibility":"friends"}
 ],"groups":[],"checks":{}}');
do $$ begin
 begin perform public.moa_friends('request',auth.uid()); raise exception 'SELF allowed' using errcode='XX000'; exception when raise_exception then null; end;
end $$;
select public.moa_friends('request','f1100000-0000-4000-8000-000000000002');
do $$ begin
 begin perform public.moa_friends('request','f1100000-0000-4000-8000-000000000002'); raise exception 'DUPLICATE allowed' using errcode='XX000'; exception when raise_exception then null; end;
 begin perform public.moa_friends('accept','f1100000-0000-4000-8000-000000000002'); raise exception 'SENDER accepted' using errcode='XX000'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.moa_friends('calendar','f1100000-0000-4000-8000-000000000001','2026-09-01'); raise exception 'PENDING read allowed' using errcode='XX000'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.calendar_accounts where user_id='f1100000-0000-4000-8000-000000000001') then raise exception 'PRIVATE document exposed'; end if;
 begin update public.moa_friendships set status='accepted'; raise exception 'DIRECT write allowed' using errcode='XX000'; exception when insufficient_privilege then null; end;
end $$;
select public.moa_friends('accept','f1100000-0000-4000-8000-000000000001');
do $$ declare result jsonb; begin
 result:=public.moa_friends('calendar','f1100000-0000-4000-8000-000000000001','2026-09-01');
 if jsonb_array_length(result)<>1 or result->0->>'id'<>'shared' then raise exception 'Private/group events leaked: %',result; end if;
 if public.moa_friends('list')->0->>'status'<>'accepted' then raise exception 'B friendship missing'; end if;
 if jsonb_array_length(public.moa_friends('calendar','f1100000-0000-4000-8000-000000000001','2026-10-01'))<>0 then raise exception 'Month filter failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000003',true);
do $$ begin
 begin perform public.moa_friends('calendar','f1100000-0000-4000-8000-000000000001','2026-09-01'); raise exception 'STRANGER read allowed' using errcode='XX000'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000001',true);
do $$ begin if public.moa_friends('list')->0->>'status'<>'accepted' then raise exception 'A friendship missing'; end if; end $$;
update public.calendar_accounts set data=jsonb_set(data,'{events,2,visibility}','"private"') where user_id=auth.uid();
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000002',true);
do $$ begin
 if jsonb_array_length(public.moa_friends('calendar','f1100000-0000-4000-8000-000000000001','2026-09-01'))<>0 then raise exception 'Visibility revocation failed'; end if;
end $$;
select public.moa_friends('remove','f1100000-0000-4000-8000-000000000001');
do $$ begin
 begin perform public.moa_friends('calendar','f1100000-0000-4000-8000-000000000001','2026-09-01'); raise exception 'REMOVED friend read allowed' using errcode='XX000'; exception when insufficient_privilege then null; end;
end $$;
select public.moa_friends('request','f1100000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000001',true);
select public.moa_friends('decline','f1100000-0000-4000-8000-000000000002');
do $$ begin if jsonb_array_length(public.moa_friends('list'))<>0 then raise exception 'Decline failed'; end if; end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.moa_friends(text,uuid,date)','EXECUTE') then raise exception 'Anonymous execute allowed'; end if;
end $$;
rollback;
