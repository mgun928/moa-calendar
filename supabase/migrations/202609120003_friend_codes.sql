begin;
create table if not exists public.moa_friend_codes(
 user_id uuid primary key references auth.users(id) on delete cascade,
 code text not null unique check(code ~ '^[A-Z0-9]{8}$')
);
alter table public.moa_friend_codes enable row level security;
revoke all on public.moa_friend_codes from public,anon,authenticated;

create or replace function public.moa_assign_friend_code(account_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare candidate text; existing text;
begin
 select code into existing from public.moa_friend_codes where user_id=account_id;
 if existing is not null then return existing; end if;
 for attempt in 1..100 loop
  candidate:=upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,8));
  insert into public.moa_friend_codes(user_id,code) values(account_id,candidate) on conflict do nothing;
  select code into existing from public.moa_friend_codes where user_id=account_id;
  if existing is not null then return existing; end if;
 end loop;
 raise exception '친구 코드 발급을 다시 시도해주세요.';
end;
$$;
revoke all on function public.moa_assign_friend_code(uuid) from public,anon,authenticated;

create or replace function public.moa_friend_code_on_signup()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform public.moa_assign_friend_code(new.id);
 return new;
end;
$$;
revoke all on function public.moa_friend_code_on_signup() from public,anon,authenticated;
drop trigger if exists moa_assign_friend_code on auth.users;
create trigger moa_assign_friend_code after insert on auth.users for each row execute function public.moa_friend_code_on_signup();
-- Existing accounts receive stable codes once; reruns preserve all issued codes.
select public.moa_assign_friend_code(id) from auth.users;

create or replace function public.moa_friend_code(action text, friend_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); result jsonb;
begin
 if me is null or not exists(select 1 from auth.users where id=me and email_confirmed_at is not null) then
  raise exception '로그인이 필요합니다.' using errcode='42501';
 end if;
 if action='own' then
  return jsonb_build_object('code',public.moa_assign_friend_code(me));
 elsif action='search' then
  if upper(trim(friend_code)) !~ '^[A-Z0-9]{8}$' or friend_code is null then raise exception '8자리 친구 코드를 입력해주세요.'; end if;
  select jsonb_build_object('id',u.id,'nickname',left(coalesce(nullif(u.raw_user_meta_data->>'nickname',''),'모아 사용자'),20)) into result
  from public.moa_friend_codes c join auth.users u on u.id=c.user_id
  where c.code=upper(trim(friend_code)) and u.email_confirmed_at is not null;
  return result;
 end if;
 raise exception '지원하지 않는 요청입니다.';
end;
$$;
revoke all on function public.moa_friend_code(text,text) from public,anon,authenticated;
grant execute on function public.moa_friend_code(text,text) to authenticated;
commit;
