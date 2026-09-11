begin;
create or replace function public.moa_friends(action text, target uuid default null, month_start date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  me uuid := auth.uid(); lo uuid; hi uuid; relation public.moa_friendships;
  result jsonb; start_day date; end_day date;
begin
  if me is null or not exists(select 1 from auth.users where id=me and email_confirmed_at is not null)
    then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
  if action='list' then
    select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nickname',left(coalesce(nullif(u.raw_user_meta_data->>'nickname',''),'모아 사용자'),20),
      'status',f.status,'incoming',f.requester<>me) order by f.created_at desc),'[]'::jsonb) into result
    from public.moa_friendships f join auth.users u on u.id=case when f.a=me then f.b else f.a end
    where me in (f.a,f.b);
    return result;
  end if;
  if target is null or target=me then raise exception '다른 사용자의 ID를 입력해주세요.'; end if;
  if action='search' then
    select jsonb_build_object('id',id,'nickname',left(coalesce(nullif(raw_user_meta_data->>'nickname',''),'모아 사용자'),20)) into result
    from auth.users where id=target and email_confirmed_at is not null;
    return result;
  end if;
  lo:=least(me,target); hi:=greatest(me,target);
  if action='request' then
    if not exists(select 1 from auth.users where id=target and email_confirmed_at is not null) then raise exception '사용자를 찾지 못했어요.'; end if;
    insert into public.moa_friendships(a,b,requester) values(lo,hi,me) on conflict do nothing;
    if not found then raise exception '이미 친구이거나 진행 중인 요청이 있어요.'; end if;
    return '{"ok":true}';
  end if;
  select * into relation from public.moa_friendships where a=lo and b=hi for update;
  if not found then raise exception '친구 관계를 확인할 수 없어요.' using errcode='42501'; end if;
  if action='accept' or action='decline' then
    if relation.status<>'pending' or relation.requester=me then raise exception '받은 요청만 처리할 수 있어요.' using errcode='42501'; end if;
    if action='accept' then update public.moa_friendships set status='accepted' where a=lo and b=hi;
    else delete from public.moa_friendships where a=lo and b=hi; end if;
    return '{"ok":true}';
  elsif action='remove' then
    delete from public.moa_friendships where a=lo and b=hi;
    return '{"ok":true}';
  elsif action='calendar' then
    if relation.status<>'accepted' then raise exception '친구만 공개 일정을 볼 수 있어요.' using errcode='42501'; end if;
    if month_start is null then raise exception '월을 선택해주세요.'; end if;
    start_day:=date_trunc('month',month_start)::date;
    end_day:=(start_day+interval '1 month')::date;
    -- Shared members always see group events; outsiders need explicit friend visibility.
    with allowed as (
      select e from public.calendar_accounts c
      cross join lateral jsonb_array_elements(c.data->'events') e
      where c.user_id=target and e->>'visibility'='friends'
        and e->>'type' in ('personal','hobby','group')
        and not (e->>'type'='group' and exists(select 1 from public.moa_shared_groups g where g.id=e->>'group'))
      union all
      select e || jsonb_build_object('type','group','group',g.id)
      from public.moa_shared_groups g cross join lateral jsonb_array_elements(g.events) e
      where (g.owner_id=target or exists(select 1 from public.moa_group_members m where m.group_id=g.id and m.user_id=target))
        and (e->>'visibility'='friends' or g.owner_id=me or exists(select 1 from public.moa_group_members m where m.group_id=g.id and m.user_id=me))
    )
    select coalesce(jsonb_agg(jsonb_build_object('id',e->>'id','title',e->>'title','date',e->>'date',
      'endDate',coalesce(e->>'endDate',e->>'date'),'time',e->>'time','endTime',e->>'endTime',
      'allDay',e->'allDay','note',e->>'note','type',e->>'type','group',e->>'group')),'[]'::jsonb) into result
    from allowed
    where e->>'date'<end_day::text and coalesce(e->>'endDate',e->>'date')>=start_day::text;
    return result;
  end if;
  raise exception '지원하지 않는 요청입니다.';
end;
$$;
revoke all on function public.moa_friends(text,uuid,date) from public,anon,authenticated;
grant execute on function public.moa_friends(text,uuid,date) to authenticated;
commit;
