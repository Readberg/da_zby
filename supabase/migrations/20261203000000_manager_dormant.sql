-- Football manager reliability, part 3 (DAZBY-151, D-138): inactive clubs. A club keeps playing to the end of
-- the season with the lineup the server picks; if more than 40% of its league matches of the season were
-- played that way (it had no saved lineup that fits), it rests at the end of the season until its owner
-- confirms the return (mgr_confirm_return). A resting club plays like a bot (picked lineup, automatic
-- training, no money, no prizes, no market), its lots and offers are cancelled and its place in the
-- league is kept. Backward compatible: new columns with defaults, new functions; mgr_close_season and
-- mgr_release_expired are recreated with the same contract (the last versions, 20261120 and 20261125, plus
-- the resting clubs); mgr_play_match_v2 stays as it is.

alter table public.mgr_clubs add column dormant boolean not null default false;
alter table public.mgr_clubs add column dormant_since timestamptz;
comment on column public.mgr_clubs.dormant is 'The club rests (plays like a bot) until its owner confirms the return.';

-- Was the side of a match played with a lineup the server picked (the owner had no saved lineup that fits)?
alter table public.mgr_matches add column home_auto boolean not null default false;
alter table public.mgr_matches add column away_auto boolean not null default false;

-- The same as mgr_play_match_v2, and the two flags of the picked lineups, in the same transaction.
create or replace function public.mgr_play_match_v3(
  p_match       uuid,
  p_home_goals  smallint,
  p_away_goals  smallint,
  p_events      jsonb,
  p_home_lineup jsonb,
  p_away_lineup jsonb,
  p_effects     jsonb,
  p_money       jsonb,
  p_home_auto   boolean,
  p_away_auto   boolean
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.mgr_play_match_v2(p_match, p_home_goals, p_away_goals, p_events, p_home_lineup, p_away_lineup, p_effects, p_money) then
    return false;
  end if;
  update public.mgr_matches set home_auto = coalesce(p_home_auto, false), away_auto = coalesce(p_away_auto, false)
  where id = p_match;
  return true;
end;
$$;

-- The owner confirms that he is back: the club plays with his lineup from the next match that is calculated.
-- Returns false when the club was not resting.
create or replace function public.mgr_confirm_return(p_user uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid;
  v_done integer;
begin
  select id into v_club from public.mgr_clubs where user_id = p_user for update;
  if not found then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  update public.mgr_clubs set dormant = false, dormant_since = null where id = v_club and dormant;
  get diagnostics v_done = row_count;
  return v_done = 1;
end;
$$;

-- A resting club cannot trade (a lot, a bid, a purchase, an offer).
create or replace function public.mgr_market_open(p_club uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.mgr_clubs where id = p_club and league_id is not null and not dormant)
    and (select count(*) from public.mgr_matches
         where kind = 'league' and status = 'finished' and p_club in (home_club_id, away_club_id)) >= 10;
$$;

-- A user who is gone: the club becomes a bot (as in 20261201; and it does not rest any more).
create or replace function public.mgr_make_bot(p_club uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_league uuid;
begin
  select league_id into v_league from public.mgr_clubs where id = p_club for update;
  if not found then
    return;
  end if;
  if v_league is null then
    delete from public.mgr_clubs where id = p_club;
    return;
  end if;
  perform public.mgr_cancel_club_market(p_club);
  delete from public.mgr_lineups where club_id = p_club;
  update public.mgr_players set training_focus = null where club_id = p_club;
  update public.mgr_clubs
  set user_id = null, is_bot = true, budget = 0, dormant = false, dormant_since = null
  where id = p_club;
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

  update public.mgr_leagues
  set phase = 'preseason', preseason_ends_at = v_last + interval '6 days', last_tick_at = v_last
  where id = p_league;
  return true;
end;
$$;

create or replace function public.mgr_release_expired(p_league uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_club     record;
  v_player   record;
  v_size     integer;
  v_released integer := 0;
  v_start    smallint;
begin
  -- Nothing to do (the usual case): leave without taking any lock.
  if not exists (
    select 1 from public.mgr_players p join public.mgr_clubs c on c.id = p.club_id
    where c.league_id = p_league and p.contract_until < public.mgr_contract_start(p_league)
  ) then
    return 0;
  end if;
  perform 1 from public.mgr_leagues where id = p_league for update;
  if not found then
    return 0;
  end if;
  -- A contract of season N is over once the first season it does not cover is the current or next one.
  v_start := public.mgr_contract_start(p_league);
  for v_club in select id, user_id, dormant from public.mgr_clubs where league_id = p_league loop
    select count(*) into v_size from public.mgr_players where club_id = v_club.id;
    for v_player in
      select id from public.mgr_players
      where club_id = v_club.id and contract_until < v_start
      order by public.mgr_nominal(ovr, age), id
    loop
      if v_club.user_id is null or v_club.dormant then
        update public.mgr_players set contract_until = v_start + 1 where id = v_player.id;
      elsif v_size > 17 then
        update public.mgr_auctions set status = 'cancelled', closed_at = now() where player_id = v_player.id and status = 'open';
        update public.mgr_trades set status = 'cancelled', resolved_at = now()
        where status = 'pending' and v_player.id = any (give_ids || take_ids);
        update public.mgr_players set club_id = null, pool_league_id = p_league, training_focus = null where id = v_player.id;
        v_size := v_size - 1;
        v_released := v_released + 1;
      else
        update public.mgr_players set contract_until = v_start where id = v_player.id;
      end if;
    end loop;
  end loop;
  return v_released;
end;
$$;

revoke execute on function public.mgr_play_match_v3(uuid, smallint, smallint, jsonb, jsonb, jsonb, jsonb, jsonb, boolean, boolean) from public, anon, authenticated;
revoke execute on function public.mgr_confirm_return(uuid) from public, anon, authenticated;
grant execute on function public.mgr_play_match_v3(uuid, smallint, smallint, jsonb, jsonb, jsonb, jsonb, jsonb, boolean, boolean) to service_role;
grant execute on function public.mgr_confirm_return(uuid) to service_role;
revoke execute on function public.mgr_close_season(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mgr_close_season(uuid, jsonb) to service_role;
revoke execute on function public.mgr_release_expired(uuid) from public, anon, authenticated;
grant execute on function public.mgr_release_expired(uuid) to service_role;
revoke execute on function public.mgr_market_open(uuid) from public, anon, authenticated;
revoke execute on function public.mgr_make_bot(uuid) from public, anon, authenticated;
