-- Football manager, stage 3 part 2 (D-129, D-132, docs/MANAGER.md): the end of a season, a preseason of
-- 5 days, ageing and retirement, the next season, and friendly matches in the preseason.
-- Backward compatible: new columns with defaults, new functions; the unique keys of matches are
-- replaced by ones that also hold the season (every existing row is season 1 and a league match).
--
-- A league is in one of two phases: 'season' (38 rounds, one a day) and 'preseason' (no official
-- matches; ends at preseason_ends_at, when the next season's round 1 is played). Everything that
-- changes the state of a league is one function that only the server (service role) may call.

alter table public.mgr_leagues add column phase text not null default 'season' check (phase in ('season', 'preseason'));
alter table public.mgr_leagues add column preseason_ends_at timestamptz;
-- The last preseason day whose training was applied (a day = 10:00 Moscow = 07:00 UTC).
alter table public.mgr_leagues add column last_tick_at timestamptz;

alter table public.mgr_matches add column season smallint not null default 1;
alter table public.mgr_matches add column kind text not null default 'league' check (kind in ('league', 'friendly'));

-- The player will retire at the end of the coming season (decided before it, the owner is warned).
alter table public.mgr_players add column retire_after_season boolean not null default false;

-- The old keys knew no season and no friendlies: drop whatever the database called them.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.mgr_matches'::regclass
      and (contype = 'u' or (contype = 'c' and pg_get_constraintdef(oid) like '%round%'))
  loop
    execute format('alter table public.mgr_matches drop constraint %I', v_name);
  end loop;
end
$$;

alter table public.mgr_matches add constraint mgr_matches_round_kind_check
  check ((kind = 'league' and round between 1 and 38) or (kind = 'friendly' and round = 0));
create unique index mgr_matches_home_slot_key on public.mgr_matches (league_id, season, round, home_club_id) where kind = 'league';
create unique index mgr_matches_away_slot_key on public.mgr_matches (league_id, season, round, away_club_id) where kind = 'league';
create index mgr_matches_friendly_idx on public.mgr_matches (league_id, kickoff_at) where kind = 'friendly';

-- Leagues whose 38th round has been played / whose preseason is over (read by the scheduler).
create or replace function public.mgr_leagues_to_close()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select l.id from public.mgr_leagues l
  where l.phase = 'season'
    and exists (select 1 from public.mgr_matches m where m.league_id = l.id and m.season = l.season and m.kind = 'league')
    and not exists (
      select 1 from public.mgr_matches m
      where m.league_id = l.id and m.season = l.season and m.kind = 'league' and m.status = 'scheduled'
    );
$$;

create or replace function public.mgr_leagues_to_open()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select l.id from public.mgr_leagues l
  where l.phase = 'preseason' and l.preseason_ends_at <= now();
$$;

-- Ends the season of a league: the players who retire leave and are replaced by young players of
-- the same position (p_replacements: [{club_id, position, first_name, last_name, age, ovr,
-- potential, attributes}]), everyone gets a year older, form, fitness and morale go back to 80,
-- and the players older than 33 are told whether they retire after the NEXT season (50% at 34,
-- +5% for every year more). Returns false when there is nothing to close (already closed).
create or replace function public.mgr_close_season(p_league uuid, p_replacements jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_league   record;
  v_last     timestamptz;
  v_expected text;
  v_given    text;
  v_item     jsonb;
  v_attr     record;
  v_player   uuid;
begin
  select * into v_league from public.mgr_leagues where id = p_league for update;
  if not found or v_league.phase <> 'season' then
    return false;
  end if;
  select max(kickoff_at) into v_last
  from public.mgr_matches where league_id = p_league and season = v_league.season and kind = 'league';
  if v_last is null or exists (
    select 1 from public.mgr_matches
    where league_id = p_league and season = v_league.season and kind = 'league' and status = 'scheduled'
  ) then
    return false;
  end if;

  select string_agg(club_id::text || position, ',' order by club_id::text || position) into v_expected
  from public.mgr_players
  where retire_after_season and club_id in (select id from public.mgr_clubs where league_id = p_league);
  select string_agg((x ->> 'club_id') || (x ->> 'position'), ',' order by (x ->> 'club_id') || (x ->> 'position')) into v_given
  from jsonb_array_elements(coalesce(p_replacements, '[]'::jsonb)) x;
  if coalesce(v_expected, '') <> coalesce(v_given, '') then
    raise exception 'manager.season_invalid' using errcode = 'P0001';
  end if;

  delete from public.mgr_players
  where retire_after_season and club_id in (select id from public.mgr_clubs where league_id = p_league);

  update public.mgr_players
  set age = age + 1, form = 80, fitness = 80, morale = 80, idle_rounds = 0
  where club_id in (select id from public.mgr_clubs where league_id = p_league);
  update public.mgr_players
  set retire_after_season = (age > 33 and random() < 0.5 + 0.05 * (age - 34))
  where club_id in (select id from public.mgr_clubs where league_id = p_league);

  for v_item in select * from jsonb_array_elements(coalesce(p_replacements, '[]'::jsonb)) loop
    insert into public.mgr_players (club_id, first_name, last_name, position, citizenship, academy_club_id, age, ovr)
    values (
      (v_item ->> 'club_id')::uuid, v_item ->> 'first_name', v_item ->> 'last_name', v_item ->> 'position',
      'BY', (v_item ->> 'club_id')::uuid, (v_item ->> 'age')::smallint, (v_item ->> 'ovr')::smallint
    )
    returning id into v_player;
    for v_attr in select key, value from jsonb_each_text(v_item -> 'attributes') loop
      insert into public.mgr_player_attributes (player_id, attribute, value)
      values (v_player, v_attr.key, v_attr.value::smallint);
    end loop;
    insert into public.mgr_player_hidden (player_id, potential)
    values (v_player, (v_item ->> 'potential')::smallint);
  end loop;

  -- A preseason of 5 days with no official match: the next round 1 is played the day after.
  update public.mgr_leagues
  set phase = 'preseason', preseason_ends_at = v_last + interval '6 days', last_tick_at = v_last
  where id = p_league;
  return true;
end;
$$;

-- Starts the next season once the preseason is over: p_matches is the schedule
-- [{round, home_club_id, away_club_id}] of the 20 clubs of the league, 38 rounds.
create or replace function public.mgr_open_season(p_league uuid, p_matches jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_league record;
  v_match  jsonb;
begin
  select * into v_league from public.mgr_leagues where id = p_league for update;
  if not found or v_league.phase <> 'preseason' or v_league.preseason_ends_at > now() then
    return false;
  end if;
  if jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) <> 380 then
    raise exception 'manager.season_invalid' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_matches) x
    where not exists (
      select 1 from public.mgr_clubs c
      where c.league_id = p_league and c.id in ((x ->> 'home_club_id')::uuid, (x ->> 'away_club_id')::uuid)
      having count(*) = 2
    )
  ) then
    raise exception 'manager.season_invalid' using errcode = 'P0001';
  end if;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    insert into public.mgr_matches (league_id, season, kind, round, home_club_id, away_club_id, kickoff_at)
    values (
      p_league, v_league.season + 1, 'league', (v_match ->> 'round')::smallint,
      (v_match ->> 'home_club_id')::uuid, (v_match ->> 'away_club_id')::uuid,
      v_league.preseason_ends_at + make_interval(days => (v_match ->> 'round')::int - 1)
    );
  end loop;
  update public.mgr_leagues
  set season = v_league.season + 1, phase = 'season', preseason_ends_at = null, last_tick_at = null
  where id = p_league;
  return true;
end;
$$;

-- One day of the preseason: p_effects [{id, fitness, ovr, attributes?}] (training at half strength).
-- Applied once per day; false when that day was already applied or is not due.
create or replace function public.mgr_apply_preseason_day(p_league uuid, p_day timestamptz, p_effects jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_done   integer;
  v_effect jsonb;
  v_attr   record;
begin
  update public.mgr_leagues
  set last_tick_at = p_day
  where id = p_league and phase = 'preseason' and last_tick_at < p_day
    and p_day <= now() and p_day < preseason_ends_at;
  get diagnostics v_done = row_count;
  if v_done <> 1 then
    return false;
  end if;

  if jsonb_typeof(p_effects) = 'array' then
    for v_effect in select * from jsonb_array_elements(p_effects) loop
      update public.mgr_players p
      set fitness = (v_effect ->> 'fitness')::smallint, ovr = (v_effect ->> 'ovr')::smallint
      where p.id = (v_effect ->> 'id')::uuid
        and p.club_id in (select id from public.mgr_clubs where league_id = p_league);
      if jsonb_typeof(v_effect -> 'attributes') = 'object' then
        for v_attr in select key, value from jsonb_each_text(v_effect -> 'attributes') loop
          update public.mgr_player_attributes a
          set value = v_attr.value::smallint
          where a.player_id = (v_effect ->> 'id')::uuid and a.attribute = v_attr.key
            and exists (
              select 1 from public.mgr_players p
              where p.id = a.player_id and p.club_id in (select id from public.mgr_clubs where league_id = p_league)
            );
        end loop;
      end if;
    end loop;
  end if;
  return true;
end;
$$;

-- A friendly match for the caller's club at the next 10:00 Moscow time, in the preseason only, one
-- a day for each of the two clubs. Without p_opponent a random free club of the league is chosen.
create or replace function public.mgr_request_friendly(p_user uuid, p_opponent uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_club   record;
  v_league record;
  v_kick   timestamptz;
  v_opp    uuid := p_opponent;
  v_match  uuid;
begin
  select id, league_id into v_club from public.mgr_clubs where user_id = p_user;
  if not found then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  select * into v_league from public.mgr_leagues where id = v_club.league_id;
  if not found or v_league.phase <> 'preseason' then
    raise exception 'manager.friendly_unavailable' using errcode = 'P0001';
  end if;

  v_kick := (date_trunc('day', now() at time zone 'utc') + interval '7 hours') at time zone 'utc';
  if v_kick < now() + interval '1 hour' then
    v_kick := v_kick + interval '1 day';
  end if;
  if v_kick >= v_league.preseason_ends_at then
    raise exception 'manager.friendly_unavailable' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.mgr_matches
    where kind = 'friendly' and kickoff_at = v_kick and v_club.id in (home_club_id, away_club_id)
  ) then
    raise exception 'manager.friendly_busy' using errcode = 'P0001';
  end if;

  if v_opp is null then
    select c.id into v_opp
    from public.mgr_clubs c
    where c.league_id = v_league.id and c.id <> v_club.id
      and not exists (
        select 1 from public.mgr_matches m
        where m.kind = 'friendly' and m.kickoff_at = v_kick and c.id in (m.home_club_id, m.away_club_id)
      )
    order by random()
    limit 1;
  elsif not exists (
    select 1 from public.mgr_clubs c
    where c.id = v_opp and c.league_id = v_league.id and c.id <> v_club.id
  ) or exists (
    select 1 from public.mgr_matches m
    where m.kind = 'friendly' and m.kickoff_at = v_kick and v_opp in (m.home_club_id, m.away_club_id)
  ) then
    v_opp := null;
  end if;
  if v_opp is null then
    raise exception 'manager.friendly_busy' using errcode = 'P0001';
  end if;

  insert into public.mgr_matches (league_id, season, kind, round, home_club_id, away_club_id, kickoff_at)
  values (v_league.id, v_league.season, 'friendly', 0, v_club.id, v_opp, v_kick)
  returning id into v_match;
  return v_match;
end;
$$;

revoke execute on function public.mgr_leagues_to_close() from public, anon, authenticated;
revoke execute on function public.mgr_leagues_to_open() from public, anon, authenticated;
revoke execute on function public.mgr_close_season(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.mgr_open_season(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.mgr_apply_preseason_day(uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.mgr_request_friendly(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mgr_leagues_to_close() to service_role;
grant execute on function public.mgr_leagues_to_open() to service_role;
grant execute on function public.mgr_close_season(uuid, jsonb) to service_role;
grant execute on function public.mgr_open_season(uuid, jsonb) to service_role;
grant execute on function public.mgr_apply_preseason_day(uuid, timestamptz, jsonb) to service_role;
grant execute on function public.mgr_request_friendly(uuid, uuid) to service_role;
