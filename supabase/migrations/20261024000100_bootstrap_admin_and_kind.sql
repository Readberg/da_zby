-- ============================================================================
-- 0.1.0 — first-admin bootstrap + tournament kind (forward compatibility)
-- Additive migration: does not change the behaviour of anything in 20261024000000.
-- ============================================================================

-- 1) Tournaments may get other kinds in the future; today there is exactly one.
alter table public.tournaments
  add column kind text not null default 'score_prediction'
  check (kind in ('score_prediction'));
comment on column public.tournaments.kind is 'Tournament mechanics. Only score_prediction exists today; extend the check via a new migration.';

-- 2) First-admin bootstrap. A user whose CONFIRMED email is listed here becomes admin
--    (and gets the listed nickname if it is still free). Nobody can read or write this table
--    from the client: RLS is on and there are no policies.
create table public.admin_bootstrap (
  email    text primary key,
  nickname text check (nickname is null or nickname ~ '^[A-Za-zА-Яа-яЁё0-9_]{3,20}$')
);
alter table public.admin_bootstrap enable row level security;
revoke all on public.admin_bootstrap from anon, authenticated;

insert into public.admin_bootstrap (email, nickname)
values ('wayreadberg@gmail.com', 'Readberg');

create or replace function public.apply_admin_bootstrap(p_user_id uuid, p_email text, p_confirmed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b record;
begin
  if not coalesce(p_confirmed, false) or p_email is null then
    return;  -- never promote on an unconfirmed email
  end if;

  select * into b from public.admin_bootstrap where lower(email) = lower(p_email);
  if not found then
    return;
  end if;

  update public.profiles set role = 'admin' where id = p_user_id;

  if b.nickname is not null then
    update public.profiles set nickname = b.nickname
     where id = p_user_id
       and nickname is null
       and not exists (select 1 from public.profiles x where lower(x.nickname::text) = lower(b.nickname));
  end if;
end $$;
revoke execute on function public.apply_admin_bootstrap(uuid, text, boolean) from public, anon, authenticated;

-- 3) Hook it into the existing auth triggers (functions replaced, behaviour extended only).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, last_login_at)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
    now()
  )
  on conflict (id) do nothing;

  insert into public.profile_private (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;

  perform public.apply_admin_bootstrap(new.id, new.email, new.email_confirmed_at is not null);
  return new;
end $$;

create or replace function public.sync_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profile_private set email = new.email where user_id = new.id;
  end if;
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles set last_login_at = new.last_sign_in_at where id = new.id;
  end if;
  if new.email_confirmed_at is distinct from old.email_confirmed_at
     or new.email is distinct from old.email then
    perform public.apply_admin_bootstrap(new.id, new.email, new.email_confirmed_at is not null);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, last_sign_in_at, email_confirmed_at on auth.users
  for each row execute function public.sync_auth_user();

-- 4) Backfill for users that signed up before this schema existed, then apply bootstrap.
insert into public.profiles (id, full_name)
select u.id, nullif(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'), '')
from auth.users u
on conflict (id) do nothing;

insert into public.profile_private (user_id, email)
select u.id, u.email from auth.users u
on conflict (user_id) do nothing;

select public.apply_admin_bootstrap(u.id, u.email, u.email_confirmed_at is not null)
from auth.users u;
