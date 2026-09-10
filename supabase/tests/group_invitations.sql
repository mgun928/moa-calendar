-- Run the ENTIRE file after the group migration. Fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('e10e2b9a-5680-40ac-8000-000000000011','moa-owner-test@example.com',now(),'{"nickname":"owner"}'),
 ('e10e2b9a-5680-40ac-8000-000000000012','moa-member-test@example.com',now(),'{"nickname":"member"}'),
 ('e10e2b9a-5680-40ac-8000-000000000013','moa-outsider-test@example.com',now(),'{"nickname":"outsider"}');
insert into public.calendar_accounts(user_id,data) values
 ('e10e2b9a-5680-40ac-8000-000000000011','{"groups":[{"id":"moa-test-group","name":"test","description":"","color":"sage","invites":[]}],"events":[],"checks":{}}');
set local role authenticated;
select set_config('request.jwt.claim.sub','e10e2b9a-5680-40ac-8000-000000000011',true);
select public.moa_groups('invite','{"group_id":"moa-test-group","emails":["moa-member-test@example.com"]}');
-- Repeat must not create duplicate invitations.
select public.moa_groups('invite','{"group_id":"moa-test-group","emails":["moa-member-test@example.com"]}');
do $$ begin
 if jsonb_array_length(public.moa_groups('members','{"group_id":"moa-test-group"}')->'invites')<>1 then raise exception 'duplicate invite'; end if;
 if jsonb_array_length(public.moa_groups('inbox'))<>0 then raise exception 'sender got recipient inbox'; end if;
end $$;
select set_config('request.jwt.claim.sub','e10e2b9a-5680-40ac-8000-000000000013',true);
do $$ begin
 if jsonb_array_length(public.moa_groups('list'))<>0 or jsonb_array_length(public.moa_groups('inbox'))<>0 then raise exception 'outsider data exposed'; end if;
 begin
  perform public.moa_groups('event_save','{"group_id":"moa-test-group","version":0}');
  raise exception 'outsider write allowed';
 exception when raise_exception then if sqlerrm<>'forbidden' then raise; end if; end;
 begin
  perform public.moa_groups('invite','{"group_id":"moa-test-group","emails":["moa-outsider-test@example.com"]}');
  raise exception 'outsider invitation allowed';
 exception when raise_exception then if sqlerrm<>'owner_only' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','e10e2b9a-5680-40ac-8000-000000000012',true);
do $$ declare inbox jsonb; begin
 inbox:=public.moa_groups('inbox');
 if jsonb_array_length(inbox)<>1 then raise exception 'recipient inbox missing'; end if;
 if jsonb_array_length(public.moa_groups('list'))<>0 then raise exception 'access before acceptance'; end if;
 perform public.moa_groups('respond',jsonb_build_object('id',inbox->0->>'id','answer','declined'));
 if jsonb_array_length(public.moa_groups('list'))<>0 then raise exception 'access after decline'; end if;
end $$;
select set_config('request.jwt.claim.sub','e10e2b9a-5680-40ac-8000-000000000011',true);
select public.moa_groups('invite','{"group_id":"moa-test-group","emails":["moa-member-test@example.com"]}');
select set_config('request.jwt.claim.sub','e10e2b9a-5680-40ac-8000-000000000012',true);
do $$ declare inbox jsonb; begin
 inbox:=public.moa_groups('inbox');
 perform public.moa_groups('respond',jsonb_build_object('id',inbox->0->>'id','answer','accepted'));
 if jsonb_array_length(public.moa_groups('list'))<>1 then raise exception 'accepted member missing group'; end if;
 if jsonb_array_length(public.moa_groups('inbox'))<>0 then raise exception 'accepted invitation still pending'; end if;
 begin
  perform public.moa_groups('delete','{"group_id":"moa-test-group","version":0}');
  raise exception 'member deleted group';
 exception when raise_exception then if sqlerrm<>'owner_only' then raise; end if; end;
 perform public.moa_groups('event_save','{"group_id":"moa-test-group","version":0,"event":{"id":"test-event","title":"shared","date":"2026-09-10","time":"09:00","endDate":"2026-09-10","endTime":"10:00","type":"group","group":"moa-test-group"}}');
 begin
  perform public.moa_groups('event_delete','{"group_id":"moa-test-group","version":0,"event_id":"test-event"}');
  raise exception 'stale edit allowed';
 exception when raise_exception then if sqlerrm<>'group_conflict' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','e10e2b9a-5680-40ac-8000-000000000011',true);
do $$ begin
 if public.moa_groups('list')->0->'events'->0->>'title'<>'shared' then raise exception 'shared event missing'; end if;
 perform public.moa_groups('update','{"group_id":"moa-test-group","version":1,"info":{"name":"updated","description":"","color":"blue"}}');
 perform public.moa_groups('event_delete','{"group_id":"moa-test-group","version":2,"event_id":"test-event"}');
 if jsonb_array_length(public.moa_groups('list')->0->'events')<>0 then raise exception 'event not deleted'; end if;
end $$;
set local role anon;
do $$ begin
 if has_function_privilege(current_user,'public.moa_groups(text,jsonb)','EXECUTE') then raise exception 'anon RPC access'; end if;
end $$;
reset role;
-- Deleting the owner's account removes group, membership and invitation rows.
delete from auth.users where id='e10e2b9a-5680-40ac-8000-000000000011';
do $$ begin
 if exists(select 1 from public.moa_shared_groups where id='moa-test-group')
 or exists(select 1 from public.moa_group_members where group_id='moa-test-group')
 or exists(select 1 from public.moa_group_invites where group_id='moa-test-group') then raise exception 'cascade failed'; end if;
end $$;
rollback;
