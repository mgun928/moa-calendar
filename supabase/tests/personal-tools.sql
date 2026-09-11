-- Optional: SQL Editor, run the whole file. Requires existing calendar and friends migrations.
-- All temporary users and records roll back.
begin;
insert into auth.users(id,email_confirmed_at) values
 ('b9110000-0000-4000-8000-000000000001',now()),
 ('b9110000-0000-4000-8000-000000000002',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','b9110000-0000-4000-8000-000000000001',true);
insert into public.calendar_accounts(user_id,data) values(auth.uid(),'{
 "events":[],"groups":[],"checks":{"reading:2026-09-11":true},
 "habits":[{"id":"reading","title":"PRIVATE HABIT","target":3}],
 "timetable":{"entries":[{"id":"tt-test","title":"PRIVATE TIMETABLE","day":0,"start":570,"end":660,"color":"#bc8158"}],"start":480,"end":1320,"weekend":false}
}');
do $$ begin
 if (select data #>> '{timetable,entries,0,start}' from public.calendar_accounts where user_id=auth.uid())<>'570'
 then raise exception 'Owner timetable read failed'; end if;
 update public.calendar_accounts set data=jsonb_set(data,'{timetable,entries,0,end}','661') where user_id=auth.uid();
 if (select data #>> '{checks,reading:2026-09-11}' from public.calendar_accounts where user_id=auth.uid())<>'true'
 then raise exception 'Legacy hobby record was lost'; end if;
end $$;
select public.moa_friends('request','b9110000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','b9110000-0000-4000-8000-000000000002',true);
select public.moa_friends('accept','b9110000-0000-4000-8000-000000000001');
do $$ declare affected integer; visible jsonb; begin
 if exists(select 1 from public.calendar_accounts where user_id='b9110000-0000-4000-8000-000000000001')
 then raise exception 'Cross-account read allowed'; end if;
 update public.calendar_accounts set data='{"events":[],"groups":[],"checks":{}}'
 where user_id='b9110000-0000-4000-8000-000000000001';
 get diagnostics affected = row_count;
 if affected<>0 then raise exception 'Cross-account update allowed'; end if;
 visible:=public.moa_friends('calendar','b9110000-0000-4000-8000-000000000001','2026-09-01');
 if visible<>'[]'::jsonb then raise exception 'Friend calendar leaked private tools: %',visible; end if;
end $$;
reset role;
rollback;
