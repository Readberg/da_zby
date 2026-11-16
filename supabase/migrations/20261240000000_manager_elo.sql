-- Football manager: Elo rating of the clubs (DAZBY-155, D-142).
-- Only league matches count (friendlies do not). Start 1000 for every club, bots included.
-- Expected score 1/(1+10^((Rb-Ra)/400)); K = 24 for the first 20 rated matches of a club, then 16;
-- no goal-difference multiplier. Counted in the same transaction as the result (a trigger on
-- mgr_matches, like the player statistics), once per match. At the end of a season the rating is
-- pulled 20% towards 1000. New clubs are placed (mgr_join_league) into the league whose real clubs
-- have the average Elo closest to 1000.
-- Backward compatible: new columns with defaults, new tables, functions and a trigger;
-- mgr_close_season and mgr_join_league are recreated with the same contract.

alter table public.mgr_clubs add column elo integer not null default 1000;
alter table public.mgr_clubs add column elo_peak integer not null default 1000;
comment on column public.mgr_clubs.elo is 'Elo rating (league matches only), start 1000; pulled 20% to 1000 at the end of a season.';
comment on column public.mgr_clubs.elo_peak is 'The highest Elo the club has had.';

-- The audit of every change.
create table public.mgr_elo_log (
  match_id   uuid not null references public.mgr_matches (id) on delete cascade,
  club_id    uuid not null references public.mgr_clubs (id) on delete cascade,
  before     integer not null,
  after      integer not null,
  created_at timestamptz not null default now(),
  unique (match_id, club_id)
);
create index mgr_elo_log_club_idx on public.mgr_elo_log (club_id, created_at);
comment on table public.mgr_elo_log is 'Elo before and after a league match, per club (mgr_apply_elo).';

-- Which matches are counted: survives the removal of a club (a bot that gave its place away).
create table public.mgr_elo_matches (
  match_id uuid primary key references public.mgr_matches (id) on delete cascade
);

alter table public.mgr_elo_log enable row level security;
alter table public.mgr_elo_matches enable row level security;

-- The log of the clubs of the league of the caller.
create policy mgr_elo_log_select on public.mgr_elo_log for select to authenticated
  using (club_id in (select id from public.mgr_clubs where league_id = (select public.mgr_my_league())));

revoke all on public.mgr_elo_log, public.mgr_elo_matches from anon, authenticated;
grant select on public.mgr_elo_log to authenticated;

-- Counts a finished league match, once. Returns false when it was already counted (or is not a
-- finished league match).
create or replace function public.mgr_apply_elo(p_match uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  m        record;
  v_home   integer;
  v_away   integer;
  v_kh     integer;
  v_ka     integer;
  v_sh     numeric;
  v_exp_h  numeric;
  v_new_h  integer;
  v_new_a  integer;
begin
  select id, kind, status, home_club_id, away_club_id, home_goals, away_goals
  into m from public.mgr_matches where id = p_match;
  if not found or m.status <> 'finished' or m.kind <> 'league'
     or m.home_goals is null or m.away_goals is null then
    return false;
  end if;
  insert into public.mgr_elo_matches (match_id) values (p_match) on conflict do nothing;
  if not found then
    return false;
  end if;

  -- Lock both clubs in a fixed order so two matches never wait for each other.
  perform 1 from public.mgr_clubs
  where id in (m.home_club_id, m.away_club_id) order by id for update;
  select elo into v_home from public.mgr_clubs where id = m.home_club_id;
  select elo into v_away from public.mgr_clubs where id = m.away_club_id;
  if v_home is null or v_away is null then
    return true;
  end if;

  v_kh := case when (select count(*) from public.mgr_elo_log where club_id = m.home_club_id) < 20 then 24 else 16 end;
  v_ka := case when (select count(*) from public.mgr_elo_log where club_id = m.away_club_id) < 20 then 24 else 16 end;
  v_sh := case when m.home_goals > m.away_goals then 1 when m.home_goals = m.away_goals then 0.5 else 0 end;
  v_exp_h := 1 / (1 + power(10::numeric, (v_away - v_home)::numeric / 400));
  v_new_h := v_home + round(v_kh * (v_sh - v_exp_h))::integer;
  v_new_a := v_away + round(v_ka * ((1 - v_sh) - (1 - v_exp_h)))::integer;

  insert into public.mgr_elo_log (match_id, club_id, before, after) values
    (p_match, m.home_club_id, v_home, v_new_h),
    (p_match, m.away_club_id, v_away, v_new_a);
  update public.mgr_clubs set elo = v_new_h, elo_peak = greatest(elo_peak, v_new_h) where id = m.home_club_id;
  update public.mgr_clubs set elo = v_new_a, elo_peak = greatest(elo_peak, v_new_a) where id = m.away_club_id;
  return true;
end;
$$;
revoke execute on function public.mgr_apply_elo(uuid) from public, anon, authenticated;
grant execute on function public.mgr_apply_elo(uuid) to service_role;

-- The same transaction as the result. A failure in the rating must never stop the league, so it
-- is only a warning (the backfill picks the match up later).
create or replace function public.mgr_elo_after_match()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  begin
    perform public.mgr_apply_elo(new.id);
  exception when others then
    raise warning 'mgr_apply_elo failed for match %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;
revoke execute on function public.mgr_elo_after_match() from public, anon, authenticated;

create trigger mgr_matches_elo
  after update of status on public.mgr_matches
  for each row
  when (old.status = 'scheduled' and new.status = 'finished')
  execute function public.mgr_elo_after_match();

-- Counts every finished league match that is not counted yet, in the order they were played
-- (the history before this migration, or a match whose counting failed). Safe to repeat; returns
-- how many it counted.
create or replace function public.mgr_backfill_elo()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.mgr_matches m
    where status = 'finished' and kind = 'league'
      and not exists (select 1 from public.mgr_elo_matches e where e.match_id = m.id)
    order by kickoff_at, round, id
  loop
    if public.mgr_apply_elo(v_id) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.mgr_backfill_elo() from public, anon, authenticated;
grant execute on function public.mgr_backfill_elo() to service_role;

select public.mgr_backfill_elo();

-- Puts a club without a league into the league with a free bot place where the average Elo of the
-- real clubs is closest to 1000 (a league without real clubs counts as 1000); then the league with
-- more free places, then the older one. Null when every league is full.
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
  join (
    select c.league_id,
           count(*) filter (where c.is_bot) as free_places,
           coalesce(avg(c.elo) filter (where not c.is_bot), 1000) as real_elo
    from public.mgr_clubs c
    where c.league_id is not null
    group by c.league_id
  ) s on s.league_id = b.league_id
  join public.mgr_leagues l on l.id = b.league_id
  where b.is_bot and b.league_id is not null
  order by abs(s.real_elo - 1000), s.free_places desc, l.created_at, l.number, random()
  limit 1;
  if v_bot is null then
    return null;
  end if;
  return public.mgr_take_bot_place(v_bot, p_club);
end;
$$;

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
  v_row      record;
  v_club     record;
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

  -- Inactive clubs: a real club that played more than 40% of its league matches of the season with a
  -- lineup the server picked (it had no saved lineup that fits) rests until its owner confirms the return.
  for v_club in
    select c.id from public.mgr_clubs c
    where c.league_id = p_league and c.user_id is not null and not c.dormant
      and (select count(*) from public.mgr_matches m
           where m.league_id = p_league and m.season = v_league.season and m.kind = 'league'
             and m.status = 'finished' and c.id in (m.home_club_id, m.away_club_id)) > 0
      and 100 * (select count(*) from public.mgr_matches m
                 where m.league_id = p_league and m.season = v_league.season and m.kind = 'league'
                   and m.status = 'finished'
                   and ((m.home_club_id = c.id and m.home_auto) or (m.away_club_id = c.id and m.away_auto)))
          > 40 * (select count(*) from public.mgr_matches m
                  where m.league_id = p_league and m.season = v_league.season and m.kind = 'league'
                    and m.status = 'finished' and c.id in (m.home_club_id, m.away_club_id))
  loop
    update public.mgr_clubs set dormant = true, dormant_since = now() where id = v_club.id;
    perform public.mgr_cancel_club_market(v_club.id);
  end loop;

  -- The prizes of the final table: the place counts all 20 clubs, bots included; bots and resting clubs are paid nothing.
  for v_row in
    with t as (
      select club, sum(pts) as pts, sum(gf) as gf, sum(ga) as ga
      from (
        select home_club_id as club,
               case when home_goals > away_goals then 3 when home_goals = away_goals then 1 else 0 end as pts,
               home_goals as gf, away_goals as ga
        from public.mgr_matches
        where league_id = p_league and season = v_league.season and kind = 'league' and status = 'finished'
        union all
        select away_club_id,
               case when away_goals > home_goals then 3 when away_goals = home_goals then 1 else 0 end,
               away_goals, home_goals
        from public.mgr_matches
        where league_id = p_league and season = v_league.season and kind = 'league' and status = 'finished'
      ) m
      group by club
    ),
    ranked as (
      select t.club, c.user_id, c.dormant,
             row_number() over (order by t.pts desc, t.gf - t.ga desc, t.gf desc, c.name) as place
      from t join public.mgr_clubs c on c.id = t.club
    )
    select club, place from ranked where user_id is not null and not dormant
  loop
    perform public.mgr_pay(v_row.club, round(4000 * (21 - v_row.place) / 20.0)::bigint, 'prize', p_league);
  end loop;

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

  -- The rating of the clubs of the league (bots too) is pulled 20% towards 1000; the peak stays.
  update public.mgr_clubs set elo = round(elo + (1000 - elo) * 0.2)::integer where league_id = p_league;

  update public.mgr_leagues
  set phase = 'preseason', preseason_ends_at = v_last + interval '6 days', last_tick_at = v_last
  where id = p_league;
  return true;
end;
$$;

revoke execute on function public.mgr_close_season(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mgr_close_season(uuid, jsonb) to service_role;
