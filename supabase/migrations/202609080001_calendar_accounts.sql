begin;

-- One private calendar document per account. Auth remains the source of identity.
create table if not exists public.calendar_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"events":[],"groups":[],"checks":{}}'::jsonb,
  version integer not null default 0 check (version >= 0),
  updated_at timestamptz not null default now(),
  constraint calendar_data_shape check (
    jsonb_typeof(data) = 'object'
    and data ?& array['events','groups','checks']
    and jsonb_typeof(data->'events') = 'array'
    and jsonb_typeof(data->'groups') = 'array'
    and jsonb_typeof(data->'checks') = 'object'
    and octet_length(data::text) <= 2097152
  )
);

alter table public.calendar_accounts enable row level security;
revoke all on public.calendar_accounts from public, anon, authenticated;
grant select, insert, update on public.calendar_accounts to authenticated;

drop policy if exists calendar_read_own on public.calendar_accounts;
create policy calendar_read_own on public.calendar_accounts for select
  to authenticated using ((select auth.uid()) = user_id);
drop policy if exists calendar_insert_own on public.calendar_accounts;
create policy calendar_insert_own on public.calendar_accounts for insert
  to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists calendar_update_own on public.calendar_accounts;
create policy calendar_update_own on public.calendar_accounts for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.calendar_account_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    new.version := 0;
  else
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.calendar_account_version() from public, anon, authenticated;
drop trigger if exists calendar_account_version on public.calendar_accounts;
create trigger calendar_account_version before insert or update on public.calendar_accounts
  for each row execute function public.calendar_account_version();

commit;
