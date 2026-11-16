-- Football manager, stage 2 (D-129, docs/MANAGER.md): leagues of 20 clubs (bots fill the free places),
-- a 38-round schedule, lineups and match results with a text chronicle.
-- Backward compatible: new tables and functions; mgr_clubs gets nullable user_id (bots) and two new
-- columns; the read policies of mgr_* tables are widened from "my club" to "my league".
--
-- All writes go through functions that only the server (service role) may call, so the rules
-- (one lineup per club, nothing changes after kickoff, a match is recorded once) live here.

create table public.mgr_leagues (
  id               uuid primary key default gen_random_uuid(),
  number           integer generated always as identity,
  season           smallint not null default 1,
  -- Kickoff of round 1; round N is N-1 days later (one round a day, 10:00 Moscow = 07:00 UTC).
  first_kickoff_at timestamptz not null,
  created_at       timestamptz not null default now()
);
comment on table public.mgr_leagues is 'A league of 20 clubs. A league always has at least one real club (it is made when a real club needs a place).';

-- Bots are clubs without a user.
alter table public.mgr_clubs alter column user_id drop not null;
alter table public.mgr_clubs add column is_bot boolean not null default false;
alter table public.mgr_clubs add column league_id uuid references public.mgr_leagues (id) on delete set null;
alter table public.mgr_clubs add constraint mgr_clubs_bot_check check (is_bot = (user_id is null));
create index mgr_clubs_league_idx on public.mgr_clubs (league_id);

create table public.mgr_matches (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references public.mgr_leagues (id) on delete cascade,
  round        smallint not null check (round between 1 and 38),
  home_club_id uuid not null references public.mgr_clubs (id) on delete cascade,
  away_club_id uuid not null references public.mgr_clubs (id) on delete cascade,
  kickoff_at   timestamptz not null,
  status       text not null default 'scheduled' check (status in ('scheduled', 'finished')),
  home_goals   smallint check (home_goals between 0 and 99),
  away_goals   smallint check (away_goals between 0 and 99),
  -- The chronicle: [{ "m": minute, "t": type, "s": "home"|"away", "p": scorer, "a": assist }].
  events       jsonb,
  -- Who played, as it was (names stay even when a bot gives its place to a real club).
  home_lineup  jsonb,
  away_lineup  jsonb,
  played_at    timestamptz,
  check (home_club_id <> away_club_id),
  check ((status = 'finished') = (home_goals is not null and away_goals is not null)),
  unique (league_id, round, home_club_id),
  unique (league_id, round, away_club_id)
);
create index mgr_matches_due_idx on public.mgr_matches (kickoff_at) where status = 'scheduled';
create index mgr_matches_home_idx on public.mgr_matches (home_club_id);
create index mgr_matches_away_idx on public.mgr_matches (away_club_id);

-- The lineup a club plays with from now on; without one (or when it is no longer valid) the server
-- picks the best one itself, without any penalty.
create table public.mgr_lineups (
  club_id    uuid primary key references public.mgr_clubs (id) on delete cascade,
  formation  text not null check (formation in ('4-4-2', '4-3-3', '3-5-2', '4-5-1', '5-3-2')),
  mentality  text not null default 'balanced' check (mentality in ('balanced', 'attack', 'defense')),
  player_ids uuid[] not null check (cardinality(player_ids) = 11),
  updated_at timestamptz not null default now()
);

alter table public.mgr_leagues enable row level security;
alter table public.mgr_matches enable row level security;
alter table public.mgr_lineups enable row level security;

-- The league of the caller (used by the policies; a function avoids a policy that reads its own table).
create or replace function public.mgr_my_league()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select league_id from public.mgr_clubs where user_id = (select auth.uid());
$$;
revoke execute on function public.mgr_my_league() from public, anon;
grant execute on function public.mgr_my_league() to authenticated;

drop policy mgr_clubs_select on public.mgr_clubs;
create policy mgr_clubs_select on public.mgr_clubs for select to authenticated
  using (user_id = (select auth.uid()) or league_id = (select public.mgr_my_league()));

create policy mgr_leagues_select on public.mgr_leagues for select to authenticated
  using (id = (select public.mgr_my_league()));

create policy mgr_matches_select on public.mgr_matches for select to authenticated
  using (league_id = (select public.mgr_my_league()));

create policy mgr_lineups_select on public.mgr_lineups for select to authenticated
  using (exists (
    select 1 from public.mgr_clubs c
    where c.id = club_id and c.user_id = (select auth.uid())
  ));

revoke all on public.mgr_leagues, public.mgr_matches, public.mgr_lineups from anon, authenticated;
grant select on public.mgr_leagues, public.mgr_matches, public.mgr_lineups to authenticated;

-- A real club takes the place of a bot: the bot's fixtures and results become the club's, the bot goes.
create or replace function public.mgr_take_bot_place(p_bot uuid, p_club uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_league uuid;
begin
  select league_id into v_league from public.mgr_clubs where id = p_bot and is_bot;
  if v_league is null then
    raise exception 'manager.no_bot_place' using errcode = 'P0001';
  end if;
  update public.mgr_matches set home_club_id = p_club where home_club_id = p_bot;
  update public.mgr_matches set away_club_id = p_club where away_club_id = p_bot;
  update public.mgr_clubs set league_id = v_league where id = p_club;
  delete from public.mgr_clubs where id = p_bot;
  return v_league;
end;
$$;
revoke execute on function public.mgr_take_bot_place(uuid, uuid) from public, anon, authenticated;

-- Puts a club without a league into one that still has a bot; null when every league is full.
create or replace function public.mgr_join_league(p_club uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_bot    uuid;
  v_league uuid;
begin
  perform pg_advisory_xact_lock(hashtext('mgr_leagues'));
  select league_id into v_league from public.mgr_clubs where id = p_club and not is_bot;
  if v_league is not null then
    return v_league;
  end if;
  if not exists (select 1 from public.mgr_clubs where id = p_club and not is_bot) then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;

  select b.id into v_bot
  from public.mgr_clubs b
  where b.is_bot and b.league_id is not null
  order by b.league_id, random()
  limit 1;
  if v_bot is null then
    return null;
  end if;
  return public.mgr_take_bot_place(v_bot, p_club);
end;
$$;

-- Makes a league of 20 bots with its 380 matches and puts the club into it, in one transaction.
create or replace function public.mgr_open_league(
  p_club           uuid,
  p_first_kickoff  timestamptz,
  p_bots           jsonb,
  p_matches        jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_league uuid;
  v_ids    uuid[] := '{}';
  v_club   uuid;
  v_bot    jsonb;
  v_item   jsonb;
  v_attr   record;
  v_player uuid;
  v_match  jsonb;
  v_name   text;
  v_n      integer;
begin
  perform pg_advisory_xact_lock(hashtext('mgr_leagues'));
  if not exists (select 1 from public.mgr_clubs where id = p_club and not is_bot and league_id is null) then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_bots) <> 'array' or jsonb_array_length(p_bots) <> 20
     or jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) <> 380 then
    raise exception 'manager.league_invalid' using errcode = 'P0001';
  end if;

  insert into public.mgr_leagues (first_kickoff_at) values (p_first_kickoff) returning id into v_league;

  for v_bot in select * from jsonb_array_elements(p_bots) loop
    if jsonb_array_length(v_bot -> 'players') <> 20
       or (select sum((x ->> 'ovr')::int) from jsonb_array_elements(v_bot -> 'players') x) is distinct from 1200 then
      raise exception 'manager.league_invalid' using errcode = 'P0001';
    end if;

    -- A taken name gets a number: the bots must never fail on a name.
    v_name := v_bot ->> 'name';
    v_n := 1;
    while exists (select 1 from public.mgr_clubs where lower(name) = lower(v_name)) loop
      v_n := v_n + 1;
      v_name := (v_bot ->> 'name') || ' ' || v_n;
    end loop;

    insert into public.mgr_clubs (user_id, is_bot, league_id, name, country, city_id, primary_color, secondary_color, squad_seed)
    values (null, true, v_league, v_name, 'BY', (v_bot ->> 'city_id')::smallint,
            v_bot ->> 'primary_color', v_bot ->> 'secondary_color', v_bot ->> 'seed')
    returning id into v_club;
    v_ids := v_ids || v_club;

    for v_item in select * from jsonb_array_elements(v_bot -> 'players') loop
      insert into public.mgr_players (club_id, first_name, last_name, position, citizenship, academy_club_id, age, ovr)
      values (v_club, v_item ->> 'first_name', v_item ->> 'last_name', v_item ->> 'position', 'BY', v_club,
              (v_item ->> 'age')::smallint, (v_item ->> 'ovr')::smallint)
      returning id into v_player;
      for v_attr in select key, value from jsonb_each_text(v_item -> 'attributes') loop
        insert into public.mgr_player_attributes (player_id, attribute, value)
        values (v_player, v_attr.key, v_attr.value::smallint);
      end loop;
      insert into public.mgr_player_hidden (player_id, potential)
      values (v_player, (v_item ->> 'potential')::smallint);
    end loop;
  end loop;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    insert into public.mgr_matches (league_id, round, home_club_id, away_club_id, kickoff_at)
    values (
      v_league, (v_match ->> 'round')::smallint,
      v_ids[(v_match ->> 'home')::int + 1], v_ids[(v_match ->> 'away')::int + 1],
      p_first_kickoff + make_interval(days => (v_match ->> 'round')::int - 1)
    );
  end loop;

  -- The real club takes a random place; the league is never played by bots alone.
  perform public.mgr_take_bot_place(v_ids[1 + floor(random() * 20)::int], p_club);
  return v_league;
end;
$$;

-- Saves the lineup of the caller's club. Refused once a round of the club is due (kickoff passed).
create or replace function public.mgr_save_lineup(
  p_user      uuid,
  p_formation text,
  p_mentality text,
  p_players   uuid[]
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid;
  v_def  int := split_part(p_formation, '-', 1)::int;
  v_mid  int := split_part(p_formation, '-', 2)::int;
  v_fwd  int := split_part(p_formation, '-', 3)::int;
begin
  select id into v_club from public.mgr_clubs where user_id = p_user;
  if v_club is null then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.mgr_matches
    where status = 'scheduled' and kickoff_at <= now()
      and (home_club_id = v_club or away_club_id = v_club)
  ) then
    raise exception 'manager.lineup_locked' using errcode = 'P0001';
  end if;

  if p_formation not in ('4-4-2', '4-3-3', '3-5-2', '4-5-1', '5-3-2')
     or p_mentality not in ('balanced', 'attack', 'defense')
     or cardinality(p_players) <> 11
     or (select count(distinct x) from unnest(p_players) x) <> 11
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players)) <> 11
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'GK') <> 1
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'DEF') <> v_def
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'MID') <> v_mid
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'FWD') <> v_fwd then
    raise exception 'manager.lineup_invalid' using errcode = 'P0001';
  end if;

  insert into public.mgr_lineups (club_id, formation, mentality, player_ids)
  values (v_club, p_formation, p_mentality, p_players)
  on conflict (club_id) do update
    set formation = excluded.formation, mentality = excluded.mentality,
        player_ids = excluded.player_ids, updated_at = now();
end;
$$;

-- Writes the result of a match once; false when it was already written (a second runner lost the race).
create or replace function public.mgr_record_match(
  p_match       uuid,
  p_home_goals  smallint,
  p_away_goals  smallint,
  p_events      jsonb,
  p_home_lineup jsonb,
  p_away_lineup jsonb
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_done integer;
begin
  update public.mgr_matches
  set status = 'finished', home_goals = p_home_goals, away_goals = p_away_goals,
      events = p_events, home_lineup = p_home_lineup, away_lineup = p_away_lineup, played_at = now()
  where id = p_match and status = 'scheduled' and kickoff_at <= now();
  get diagnostics v_done = row_count;
  return v_done = 1;
end;
$$;

revoke execute on function public.mgr_join_league(uuid) from public, anon, authenticated;
revoke execute on function public.mgr_open_league(uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.mgr_save_lineup(uuid, text, text, uuid[]) from public, anon, authenticated;
revoke execute on function public.mgr_record_match(uuid, smallint, smallint, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.mgr_join_league(uuid) to service_role;
grant execute on function public.mgr_open_league(uuid, timestamptz, jsonb, jsonb) to service_role;
grant execute on function public.mgr_save_lineup(uuid, text, text, uuid[]) to service_role;
grant execute on function public.mgr_record_match(uuid, smallint, smallint, jsonb, jsonb, jsonb) to service_role;
