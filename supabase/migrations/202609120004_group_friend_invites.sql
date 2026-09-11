begin;
-- Resolve accepted friends on the server; never expose their email addresses.
create or replace function public.moa_invite_group_friends(group_id text, friend_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 me uuid := auth.uid(); target uuid; address text; addresses jsonb := '[]'::jsonb;
begin
 if me is null or not exists(select 1 from auth.users where id=me and email_confirmed_at is not null)
 then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
 if coalesce(cardinality(friend_ids),0) not between 1 and 20 then raise exception '친구를 1명 이상 20명 이하로 선택해주세요.'; end if;
 for target in select distinct unnest(friend_ids) loop
  if target is null or target=me then raise exception '초대할 친구를 확인해주세요.'; end if;
  perform 1 from public.moa_friendships f
   where f.a=least(me,target) and f.b=greatest(me,target) and f.status='accepted' for share;
  if not found then raise exception '친구 관계가 변경되었어요. 친구 목록을 다시 확인해주세요.' using errcode='42501'; end if;
  select email into address from auth.users where id=target and email_confirmed_at is not null;
  if address is null then raise exception '초대할 수 없는 계정이 포함되어 있어요.'; end if;
  addresses := addresses || jsonb_build_array(address);
 end loop;
 -- Existing RPC checks group ownership and handles promotion/invite acceptance.
 return public.moa_groups('invite',jsonb_build_object('group_id',group_id,'emails',addresses));
end;
$$;
revoke all on function public.moa_invite_group_friends(text,uuid[]) from public,anon;
grant execute on function public.moa_invite_group_friends(text,uuid[]) to authenticated;
commit;
