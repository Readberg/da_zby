-- ============================================================================
-- DA ZABEY — initial schema (v0.1.0)
-- Target: Supabase (Postgres 15+). Time is stored in UTC (timestamptz).
-- Principle: every rule that matters (deadlines, scoring, roles) is enforced in
-- the database, never only in the UI. See docs/DATA_MODEL.md.
-- ============================================================================

create extension if not exists citext with schema extensions;

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- Profiles
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  nickname           extensions.citext unique
                       check (nickname is null or nickname ~ '^[A-Za-zА-Яа-яЁё0-9_]{3,20}$'),
  full_name          text check (char_length(full_name) <= 100),
  contact            text check (char_length(contact) <= 200),
  about              text check (char_length(about) <= 1000),
  avatar_path        text,
  country_code       char(2) check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  city               text check (char_length(city) <= 100),
  utc_offset_minutes smallint not null default 180
                       check (utc_offset_minutes between -720 and 840),
  role               text not null default 'user' check (role in ('user', 'admin')),
  created_at         timestamptz not null default now(),
  last_login_at      timestamptz,
  updated_at         timestamptz not null default now()
);
comment on column public.profiles.nickname is 'NULL until the user completes onboarding (needed for Google/Telegram sign-ups).';
comment on column public.profiles.utc_offset_minutes is 'Display time zone as a fixed UTC offset in minutes. Default 180 = UTC+3 (Minsk).';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Private data (email) — never publicly readable.
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email   text
);

-- is_admin() is used by almost every policy below.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Create profile rows when a user signs up.
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

  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep email and last login in sync.
create or replace function public.sync_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profile_private set email = new.email where user_id = new.id;
  end if;
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles set last_login_at = new.last_sign_in_at where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_updated after update of email, last_sign_in_at on auth.users
  for each row execute function public.sync_auth_user();

-- Admin-only role management (users can never change their own role).
create or replace function public.set_user_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new_role not in ('user', 'admin') then
    raise exception 'invalid role';
  end if;
  if new_role = 'user'
     and (select count(*) from public.profiles where role = 'admin') <= 1
     and (select role from public.profiles where id = target) = 'admin' then
    raise exception 'cannot demote the last admin';
  end if;
  update public.profiles set role = new_role where id = target;
end $$;

-- ----------------------------------------------------------------------------
-- Reference data: tournaments, seasons, clubs, tours, matches
-- ----------------------------------------------------------------------------
create table public.tournaments (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  slug           text not null unique check (slug ~ '^[a-z0-9-]+$'),
  points_exact   smallint not null default 3 check (points_exact >= 0),
  points_outcome smallint not null default 1 check (points_outcome >= 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger tournaments_updated_at before update on public.tournaments
  for each row execute function public.set_updated_at();

create table public.seasons (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name          text not null,
  status        text not null default 'active' check (status in ('active', 'closed')),
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique (tournament_id, name)
);
create index seasons_tournament_idx on public.seasons (tournament_id);

create table public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  short_name text,
  logo_path  text,
  created_at timestamptz not null default now()
);

-- Roster of clubs that take part in a season (drives dropdowns in the admin UI).
create table public.season_clubs (
  season_id uuid not null references public.seasons (id) on delete cascade,
  club_id   uuid not null references public.clubs (id) on delete restrict,
  primary key (season_id, club_id)
);

create table public.tours (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references public.seasons (id) on delete cascade,
  number            integer not null check (number > 0),
  title             text,                      -- e.g. '1/16 финала' for cups
  deadline_override timestamptz,               -- admin can pin the prediction deadline
  created_at        timestamptz not null default now(),
  unique (season_id, number)
);
create index tours_season_idx on public.tours (season_id);

create table public.matches (
  id           uuid primary key default gen_random_uuid(),
  tour_id      uuid not null references public.tours (id) on delete cascade,
  home_club_id uuid not null references public.clubs (id) on delete restrict,
  away_club_id uuid not null references public.clubs (id) on delete restrict,
  kickoff_at   timestamptz not null,
  status       text not null default 'scheduled'
                 check (status in ('scheduled', 'finished', 'postponed', 'cancelled')),
  home_score   smallint check (home_score between 0 and 99),
  away_score   smallint check (away_score between 0 and 99),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (home_club_id <> away_club_id),
  check (status <> 'finished' or (home_score is not null and away_score is not null))
);
comment on column public.matches.home_score is 'Final score incl. extra time, EXCLUDING penalty shoot-out.';
create index matches_tour_kickoff_idx on public.matches (tour_id, kickoff_at);
create trigger matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Deadline logic
-- ----------------------------------------------------------------------------
-- A tour accepts predictions until 10 minutes before its first (non-cancelled) match,
-- unless the admin pinned deadline_override.
create or replace function public.tour_deadline(p_tour_id uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select coalesce(
    t.deadline_override,
    (select min(m.kickoff_at) from public.matches m
      where m.tour_id = t.id and m.status <> 'cancelled') - interval '10 minutes'
  )
  from public.tours t where t.id = p_tour_id;
$$;

create or replace function public.can_predict(p_match_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select s.status = 'active'
       and m.status in ('scheduled', 'postponed')
       and now() < public.tour_deadline(t.id)
    from public.matches m
    join public.tours t   on t.id = m.tour_id
    join public.seasons s on s.id = t.season_id
    where m.id = p_match_id
  ), false);
$$;

-- ----------------------------------------------------------------------------
-- Predictions
-- ----------------------------------------------------------------------------
create table public.predictions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  match_id   uuid not null references public.matches (id) on delete cascade,
  home_score smallint not null check (home_score between 0 and 99),
  away_score smallint not null check (away_score between 0 and 99),
  result     text check (result in ('exact', 'outcome', 'miss')),  -- NULL until graded
  points     smallint,                                              -- NULL until graded
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);
create index predictions_match_idx on public.predictions (match_id);
create index predictions_user_idx  on public.predictions (user_id);
create trigger predictions_updated_at before update on public.predictions
  for each row execute function public.set_updated_at();

-- Grade predictions automatically whenever the admin saves/changes a match result.
create or replace function public.grade_match()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_exact   smallint;
  v_outcome smallint;
begin
  if new.status = 'finished' and new.home_score is not null and new.away_score is not null then
    select tr.points_exact, tr.points_outcome
      into v_exact, v_outcome
      from public.tours t
      join public.seasons s on s.id = t.season_id
      join public.tournaments tr on tr.id = s.tournament_id
     where t.id = new.tour_id;

    update public.predictions p set
      result = case
        when p.home_score = new.home_score and p.away_score = new.away_score then 'exact'
        when sign(p.home_score - p.away_score) = sign(new.home_score - new.away_score) then 'outcome'
        else 'miss' end,
      points = case
        when p.home_score = new.home_score and p.away_score = new.away_score then v_exact
        when sign(p.home_score - p.away_score) = sign(new.home_score - new.away_score) then v_outcome
        else 0 end
    where p.match_id = new.id;
  else
    update public.predictions set result = null, points = null where match_id = new.id;
  end if;
  return null;
end $$;

create trigger matches_grade after insert or update of status, home_score, away_score on public.matches
  for each row execute function public.grade_match();

-- Admin: re-grade a whole season (e.g. after changing points in tournament settings).
create or replace function public.recalculate_season(p_season_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for r in
    select m.id from public.matches m
    join public.tours t on t.id = m.tour_id
    where t.season_id = p_season_id and m.status = 'finished'
  loop
    -- touching the row re-fires the grading trigger
    update public.matches set status = status where id = r.id;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Season standings snapshot (fixed final places) + close / reopen
-- ----------------------------------------------------------------------------
create table public.season_standings (
  season_id         uuid not null references public.seasons (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  final_rank        integer not null,
  points            integer not null,
  exact_count       integer not null,
  outcome_count     integer not null,
  miss_count        integer not null,
  predictions_count integer not null,
  created_at        timestamptz not null default now(),
  primary key (season_id, user_id)
);

-- ----------------------------------------------------------------------------
-- Leaderboard views (security_invoker => RLS of the caller applies)
-- ----------------------------------------------------------------------------
create or replace view public.season_leaderboard with (security_invoker = on) as
with stats as (
  select
    t.season_id,
    p.user_id,
    count(*)                                   as predictions_count,
    count(*) filter (where p.result = 'exact')   as exact_count,
    count(*) filter (where p.result = 'outcome') as outcome_count,
    count(*) filter (where p.result = 'miss')    as miss_count,
    coalesce(sum(p.points), 0)::int            as points
  from public.predictions p
  join public.matches m on m.id = p.match_id
  join public.tours t   on t.id = m.tour_id
  group by t.season_id, p.user_id
)
select
  s.season_id,
  s.user_id,
  s.predictions_count,
  s.exact_count,
  s.outcome_count,
  s.miss_count,
  (s.exact_count + s.outcome_count)                                        as wins_count,
  s.miss_count                                                             as losses_count,
  case when (s.exact_count + s.outcome_count + s.miss_count) = 0 then null
       else round(100.0 * (s.exact_count + s.outcome_count)
                  / (s.exact_count + s.outcome_count + s.miss_count), 1) end as win_rate,
  s.points,
  rank() over (partition by s.season_id
               order by s.points desc, s.exact_count desc, s.outcome_count desc) as current_rank,
  ss.final_rank
from stats s
left join public.season_standings ss
  on ss.season_id = s.season_id and ss.user_id = s.user_id;

create or replace view public.tour_leaderboard with (security_invoker = on) as
with stats as (
  select
    m.tour_id,
    p.user_id,
    count(*)                                   as predictions_count,
    count(*) filter (where p.result = 'exact')   as exact_count,
    count(*) filter (where p.result = 'outcome') as outcome_count,
    count(*) filter (where p.result = 'miss')    as miss_count,
    coalesce(sum(p.points), 0)::int            as points
  from public.predictions p
  join public.matches m on m.id = p.match_id
  group by m.tour_id, p.user_id
)
select
  s.*,
  rank() over (partition by s.tour_id
               order by s.points desc, s.exact_count desc, s.outcome_count desc) as current_rank
from stats s;

create or replace function public.close_season(p_season_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.season_standings where season_id = p_season_id;

  insert into public.season_standings
    (season_id, user_id, final_rank, points, exact_count, outcome_count, miss_count, predictions_count)
  select season_id, user_id, current_rank, points, exact_count, outcome_count, miss_count, predictions_count
  from public.season_leaderboard
  where season_id = p_season_id;

  update public.seasons set status = 'closed', closed_at = now() where id = p_season_id;
end $$;

-- Rollback of close_season.
create or replace function public.reopen_season(p_season_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.season_standings where season_id = p_season_id;
  update public.seasons set status = 'active', closed_at = null where id = p_season_id;
end $$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.profile_private  enable row level security;
alter table public.tournaments      enable row level security;
alter table public.seasons          enable row level security;
alter table public.clubs            enable row level security;
alter table public.season_clubs     enable row level security;
alter table public.tours            enable row level security;
alter table public.matches          enable row level security;
alter table public.predictions      enable row level security;
alter table public.season_standings enable row level security;

-- profiles: public read, owner updates a whitelist of columns (see GRANTs below)
create policy profiles_select on public.profiles for select to anon, authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- profile_private: owner and admins only; writes only through triggers
create policy profile_private_select on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Public read + admin write for reference data
do $$
declare t text;
begin
  foreach t in array array['tournaments','seasons','clubs','season_clubs','tours','matches','season_standings']
  loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_select', t);
  end loop;

  foreach t in array array['tournaments','seasons','clubs','season_clubs','tours','matches']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_write', t);
  end loop;
end $$;

-- predictions: everyone can read (decision D-005); owner writes only before the deadline
create policy predictions_select on public.predictions for select to anon, authenticated using (true);
create policy predictions_insert_own on public.predictions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_predict(match_id));
create policy predictions_update_own on public.predictions for update to authenticated
  using (user_id = (select auth.uid()) and public.can_predict(match_id))
  with check (user_id = (select auth.uid()) and public.can_predict(match_id));
create policy predictions_delete_own on public.predictions for delete to authenticated
  using (user_id = (select auth.uid()) and public.can_predict(match_id));

-- ----------------------------------------------------------------------------
-- Column-level privileges: clients can never write role / result / points
-- ----------------------------------------------------------------------------
revoke insert, update, delete on public.profiles        from anon, authenticated;
revoke all on public.profile_private                    from anon, authenticated;
grant  select on public.profile_private                 to authenticated;
revoke insert, update on public.predictions             from anon, authenticated;
revoke insert, update, delete on public.season_standings from anon, authenticated;

grant update (nickname, full_name, contact, about, avatar_path, country_code, city, utc_offset_minutes)
  on public.profiles to authenticated;
grant insert (user_id, match_id, home_score, away_score) on public.predictions to authenticated;
grant update (home_score, away_score)                    on public.predictions to authenticated;

revoke execute on function public.set_user_role(uuid, text)   from public, anon;
revoke execute on function public.recalculate_season(uuid)    from public, anon;
revoke execute on function public.close_season(uuid)          from public, anon;
revoke execute on function public.reopen_season(uuid)         from public, anon;

-- ----------------------------------------------------------------------------
-- Storage buckets and policies
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',    'avatars',    true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('club-logos', 'club-logos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy club_logos_read on storage.objects for select
  using (bucket_id = 'club-logos');
create policy club_logos_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'club-logos' and public.is_admin())
  with check (bucket_id = 'club-logos' and public.is_admin());

-- ----------------------------------------------------------------------------
-- After the first sign-up, make yourself the first admin (SQL editor, one time):
--   update public.profiles set role = 'admin' where id = '<your auth.users id>';
-- ----------------------------------------------------------------------------
