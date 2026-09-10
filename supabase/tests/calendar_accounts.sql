-- Run AFTER the migration, in SQL Editor. All fixture changes roll back.
begin;
insert into auth.users (id) values
 ('e10e2b9a-5680-40ac-8000-000000000001'),
 ('e10e2b9a-5680-40ac-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e10e2b9a-5680-40ac-8000-000000000001', true);
insert into public.calendar_accounts(user_id) values ('e10e2b9a-5680-40ac-8000-000000000001');
do $$ begin
  if (select count(*) from public.calendar_accounts) <> 1 then raise exception 'Own row read failed'; end if;
  begin
    insert into public.calendar_accounts(user_id) values ('e10e2b9a-5680-40ac-8000-000000000002');
    raise exception 'Cross-account insert was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.calendar_accounts set user_id = 'e10e2b9a-5680-40ac-8000-000000000002';
    raise exception 'Owner reassignment was allowed';
  exception when insufficient_privilege then null;
  end;
  update public.calendar_accounts set data = '{"events":[],"groups":[],"checks":{"test":true}}';
  if (select version from public.calendar_accounts) <> 1 then raise exception 'Version update failed'; end if;
end $$;
select set_config('request.jwt.claim.sub', 'e10e2b9a-5680-40ac-8000-000000000002', true);
do $$ declare affected integer; begin
  if exists(select 1 from public.calendar_accounts) then raise exception 'Cross-account read was allowed'; end if;
  update public.calendar_accounts set data = '{"events":[],"groups":[],"checks":{}}';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-account update was allowed'; end if;
  begin
    delete from public.calendar_accounts;
    raise exception 'Direct delete was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role anon;
do $$ begin
  if has_table_privilege(current_user, 'public.calendar_accounts', 'SELECT')
    or has_table_privilege(current_user, 'public.calendar_accounts', 'INSERT')
    or has_table_privilege(current_user, 'public.calendar_accounts', 'UPDATE')
    or has_table_privilege(current_user, 'public.calendar_accounts', 'DELETE')
  then raise exception 'Anonymous access was allowed'; end if;
end $$;
reset role;
delete from auth.users where id = 'e10e2b9a-5680-40ac-8000-000000000001';
do $$ begin
  if exists(select 1 from public.calendar_accounts where user_id = 'e10e2b9a-5680-40ac-8000-000000000001')
  then raise exception 'Account deletion did not cascade'; end if;
end $$;
rollback;
