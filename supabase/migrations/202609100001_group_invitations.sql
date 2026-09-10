begin;
create table if not exists public.moa_shared_groups (
 id text primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 info jsonb not null, events jsonb not null default '[]', version integer not null default 0,
 check (jsonb_typeof(events) = 'array' and octet_length(events::text) < 1048576)
);
create table if not exists public.moa_group_members (
 group_id text references public.moa_shared_groups(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade, primary key(group_id,user_id)
);
create table if not exists public.moa_group_invites (
 id uuid primary key default gen_random_uuid(),
 group_id text not null references public.moa_shared_groups(id) on delete cascade,
 recipient uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(), unique(group_id,recipient)
);
alter table public.moa_shared_groups enable row level security;
alter table public.moa_group_members enable row level security;
alter table public.moa_group_invites enable row level security;
revoke all on public.moa_shared_groups, public.moa_group_members, public.moa_group_invites from public, anon, authenticated;
-- Tables deny direct API access. This RPC checks identity and membership for every operation.
create or replace function public.moa_groups(action text, payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 me uuid := auth.uid(); g public.moa_shared_groups; inv public.moa_group_invites;
 gid text := payload->>'group_id'; target uuid; addr text; result jsonb;
 info jsonb; item jsonb; uid text;
begin
 if me is null or not exists(select 1 from auth.users where id=me and email_confirmed_at is not null)
 then raise exception 'unauthorized'; end if;
 if action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'info',s.info,'events',s.events,'version',s.version,'owner',s.owner_id=me)), '[]') into result
  from public.moa_shared_groups s where s.owner_id=me or exists(select 1 from public.moa_group_members m where m.group_id=s.id and m.user_id=me);
  return result;
 elsif action='inbox' then
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',s.info->>'name','sender',coalesce(u.raw_user_meta_data->>'nickname',u.email),'created_at',i.created_at) order by i.created_at desc),'[]') into result
  from public.moa_group_invites i join public.moa_shared_groups s on s.id=i.group_id join auth.users u on u.id=s.owner_id
  where i.recipient=me and i.status='pending'; return result;
 elsif action='respond' then
  select * into inv from public.moa_group_invites where id=(payload->>'id')::uuid for update;
  if not found or inv.recipient<>me then raise exception 'forbidden'; end if;
  if inv.status<>'pending' then raise exception 'invite_closed'; end if;
  if payload->>'answer' not in ('accepted','declined') or payload->>'answer' is null then raise exception 'invalid_input'; end if;
  if payload->>'answer'='accepted' then
   insert into public.moa_group_members values(inv.group_id,me) on conflict do nothing;
  end if;
  update public.moa_group_invites set status=payload->>'answer' where id=inv.id;
  return '{}'::jsonb;
 end if;
 if action='invite' then
  -- Serialize creation/promotion of the same group, including concurrent tabs.
  perform pg_advisory_xact_lock(hashtextextended(gid,0));
  select * into g from public.moa_shared_groups where id=gid for update;
  if not found then
   -- Only promote a private group actually owned by the signed-in account.
   select x into info from public.calendar_accounts c, jsonb_array_elements(c.data->'groups') x where c.user_id=me and x->>'id'=gid;
   if info is null then raise exception 'group_not_saved'; end if;
   select coalesce(jsonb_agg(x),'[]') into result from public.calendar_accounts c,jsonb_array_elements(c.data->'events') x
    where c.user_id=me and x->>'type'='group' and x->>'group'=gid;
   insert into public.moa_shared_groups(id,owner_id,info,events) values(gid,me,info - 'invites',result);
   select * into g from public.moa_shared_groups where id=gid for update;
  end if;
  if g.owner_id<>me then raise exception 'owner_only'; end if;
  if jsonb_typeof(payload->'emails') is distinct from 'array' then raise exception 'invalid_input'; end if;
  if jsonb_array_length(payload->'emails') not between 1 and 20 then raise exception 'invalid_input'; end if;
  for addr in select distinct lower(trim(value)) from jsonb_array_elements_text(payload->'emails') loop
   select id into target from auth.users where lower(email)=addr and email_confirmed_at is not null;
   if target is null then raise exception 'recipient_not_found'; end if;
   if target=me then raise exception 'cannot_invite_self'; end if;
   if exists(select 1 from public.moa_group_members where group_id=gid and user_id=target) then raise exception 'already_member'; end if;
   insert into public.moa_group_invites(group_id,recipient) values(gid,target)
    on conflict(group_id,recipient) do update set status='pending',created_at=now()
    where moa_group_invites.status in ('declined','cancelled');
  end loop;
  return '{}'::jsonb;
 end if;
 select * into g from public.moa_shared_groups where id=gid for update;
 if not found or not (g.owner_id=me or exists(select 1 from public.moa_group_members where group_id=gid and user_id=me)) then raise exception 'forbidden'; end if;
 if action='members' then
  select jsonb_build_object('members',
   (select coalesce(jsonb_agg(jsonb_build_object('name',coalesce(u.raw_user_meta_data->>'nickname',u.email),'owner',u.id=g.owner_id)),'[]')
    from auth.users u where u.id=g.owner_id or exists(select 1 from public.moa_group_members m where m.group_id=gid and m.user_id=u.id)),
   'invites',case when g.owner_id=me then
    (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',u.email,'status',i.status)),'[]') from public.moa_group_invites i join auth.users u on u.id=i.recipient where i.group_id=gid)
    else '[]'::jsonb end) into result; return result;
 elsif action='cancel' then
  if g.owner_id<>me then raise exception 'owner_only'; end if;
  update public.moa_group_invites set status='cancelled' where id=(payload->>'id')::uuid and group_id=gid and status='pending'; return '{}';
 elsif action in ('event_save','event_delete','update','delete') then
  if (payload->>'version')::integer is distinct from g.version then raise exception 'group_conflict'; end if;
  if action in ('update','delete') and g.owner_id<>me then raise exception 'owner_only'; end if;
  if action='delete' then
   -- Remove the old private copy too, so it cannot reappear after deletion.
   update public.calendar_accounts c set data=jsonb_set(jsonb_set(c.data,'{groups}',
    coalesce((select jsonb_agg(x) from jsonb_array_elements(c.data->'groups') x where x->>'id'<>gid),'[]')),'{events}',
    coalesce((select jsonb_agg(x) from jsonb_array_elements(c.data->'events') x where not(x->>'type'='group' and x->>'group'=gid)),'[]')) where user_id=me;
   delete from public.moa_shared_groups where id=gid; return '{}';
  elsif action='update' then
   info:=payload->'info';
   if jsonb_typeof(info->'name') is distinct from 'string' or jsonb_typeof(info->'description') is distinct from 'string' or length(trim(coalesce(info->>'name',''))) not between 1 and 30 or length(coalesce(info->>'description',''))>100
    or not(coalesce(info->>'color','') ~ '^#[0-9a-fA-F]{6}$' or coalesce(info->>'color','') in ('sage','clay','lavender','blue')) then raise exception 'invalid_input'; end if;
   update public.moa_shared_groups set info=(payload->'info') - 'invites',version=version+1 where id=gid;
  else
   item:=payload->'event'; uid:=coalesce(item->>'id',payload->>'event_id');
   if uid is null or length(uid)>200 then raise exception 'invalid_input'; end if;
   if action='event_save' then
    if jsonb_typeof(item->'title') is distinct from 'string' or length(trim(coalesce(item->>'title',''))) not between 1 and 200 or item->>'type' is distinct from 'group' or item->>'group' is distinct from gid
     or coalesce(item->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(item->>'time','') !~ '^\d{2}:\d{2}$'
     or coalesce(item->>'endDate','') !~ '^\d{4}-\d{2}-\d{2}$'
     or coalesce(item->>'endTime','') !~ '^\d{2}:\d{2}$'
     or length(coalesce(item->>'note',''))>5000 then raise exception 'invalid_input'; end if;
    if (item->>'endDate')::date < (item->>'date')::date then raise exception 'invalid_input'; end if;
    perform (item->>'time')::time, (item->>'endTime')::time;
   end if;
   select coalesce(jsonb_agg(x),'[]') into result from jsonb_array_elements(g.events) x where x->>'id'<>uid;
   if action='event_save' then result:=result || jsonb_build_array(item); end if;
   update public.moa_shared_groups set events=result,version=version+1 where id=gid;
  end if;
  return '{}';
 end if;
 raise exception 'invalid_action';
end;
$$;
revoke all on function public.moa_groups(text,jsonb) from public,anon;
grant execute on function public.moa_groups(text,jsonb) to authenticated;
commit;
