begin;
create or replace function public.moa_friend_timetable(target uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); result jsonb;
begin
 if me is null or not exists(select 1 from auth.users where id=me and email_confirmed_at is not null) then
  raise exception '로그인이 필요합니다.' using errcode='42501';
 end if;
 if not exists(select 1 from public.moa_friendships where a=least(me,target) and b=greatest(me,target) and status='accepted') then
  raise exception '친구만 시간표를 볼 수 있어요.' using errcode='42501';
 end if;
 if not exists(select 1 from public.calendar_accounts where user_id=target and data->'timetable'->>'visibility'='friends') then
  return '{"shared":false}'::jsonb;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e->>'id','title',e->>'title','day',e->'day','start',e->'start','end',e->'end','place',e->>'place','color',e->>'color')),'[]'::jsonb) into result
 from public.calendar_accounts c cross join lateral jsonb_array_elements(coalesce(c.data->'timetable'->'entries','[]'::jsonb)) e where c.user_id=target;
 return jsonb_build_object('shared',true,'entries',result);
end;
$$;
revoke all on function public.moa_friend_timetable(uuid) from public,anon,authenticated;
grant execute on function public.moa_friend_timetable(uuid) to authenticated;
commit;
