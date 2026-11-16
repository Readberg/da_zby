-- Football manager, stage 4, part 1 (D-129, D-133, docs/ECONOMY.md): the money of a club, the
-- ledger of its operations, prizes at the end of a season, and the monthly pool of free players
-- that a club can buy at their nominal value.
-- Backward compatible: new columns with defaults and new functions; mgr_players.club_id becomes
-- nullable (a free player has no club, only the league whose pool he is in).
--
-- All money moves through functions that only the server (service role) may call, in the same
-- transaction as what causes it (a played match, the end of a season, a purchase), so nothing is
-- paid twice and a balance always equals the sum of its ledger.

alter table public.mgr_clubs add column budget bigint not null default 10000;
alter table public.mgr_leagues add column pool_month text;

create table public.mgr_transactions (
  id            bigint generated always as identity primary key,
  club_id       uuid not null references public.mgr_clubs (id) on delete cascade,
  amount        bigint not null check (amount <> 0),
  reason        text not null check (reason in ('base', 'tickets', 'premium', 'wages', 'prize', 'purchase', 'sale', 'tax')),
  -- The match or the player the operation is about.
  ref           uuid,
  balance_after bigint not null,
  created_at    timestamptz not null default now()
);
create index mgr_transactions_club_idx on public.mgr_transactions (club_id, id desc);
comment on table public.mgr_transactions is 'The ledger of a club: every change of the budget, with the balance after it.';

alter table public.mgr_transactions enable row level security;
create policy mgr_transactions_select on public.mgr_transactions for select to authenticated
  using (exists (
    select 1 from public.mgr_clubs c
    where c.id = club_id and c.user_id = (select auth.uid())
  ));
revoke all on public.mgr_transactions from anon, authenticated;
grant select on public.mgr_transactions to authenticated;

-- A free player: no club, in the pool of a league.
alter table public.mgr_players alter column club_id drop not null;
alter table public.mgr_players add column pool_league_id uuid references public.mgr_leagues (id) on delete cascade;
alter table public.mgr_players add constraint mgr_players_owner_check
  check (club_id is not null or pool_league_id is not null);
create index mgr_players_pool_idx on public.mgr_players (pool_league_id) where club_id is null;

drop policy mgr_players_select on public.mgr_players;
create policy mgr_players_select on public.mgr_players for select to authenticated
  using (
    exists (
      select 1 from public.mgr_clubs c
      where c.id = club_id and c.user_id = (select auth.uid())
    )
    or (club_id is null and pool_league_id = (select public.mgr_my_league()))
  );

drop policy mgr_player_attributes_select on public.mgr_player_attributes;
create policy mgr_player_attributes_select on public.mgr_player_attributes for select to authenticated
  using (exists (
    select 1 from public.mgr_players p
    where p.id = player_id
      and (
        exists (select 1 from public.mgr_clubs c where c.id = p.club_id and c.user_id = (select auth.uid()))
        or (p.club_id is null and p.pool_league_id = (select public.mgr_my_league()))
      )
  ));

-- The nominal value of a player ("номинал"): 1000 * 1.12^(ovr - 60) * a factor of the age. The same
-- formula as src/lib/manager/economy.ts (a test compares them).
create or replace function public.mgr_nominal(p_ovr integer, p_age integer)
returns integer
language sql immutable set search_path = ''
as $$
  select round(
    1000 * power(1.12::numeric, p_ovr - 60) * case
      when p_age <= 21 then 1.3
      when p_age <= 26 then 1.0
      when p_age <= 29 then 0.8
      when p_age <= 32 then 0.55
      else 0.3
    end
  )::integer;
$$;
revoke execute on function public.mgr_nominal(integer, integer) from public, anon;
grant execute on function public.mgr_nominal(integer, integer) to authenticated, service_role;

-- Adds an amount to the budget of a club and writes it to the ledger. Inside other functions only.
create or replace function public.mgr_pay(p_club uuid, p_amount bigint, p_reason text, p_ref uuid)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_balance bigint;
begin
  if p_amount = 0 then
    select budget into v_balance from public.mgr_clubs where id = p_club;
    return v_balance;
  end if;
  update public.mgr_clubs set budget = budget + p_amount where id = p_club returning budget into v_balance;
  insert into public.mgr_transactions (club_id, amount, reason, ref, balance_after)
  values (p_club, p_amount, p_reason, p_ref, v_balance);
  return v_balance;
end;
$$;
revoke execute on function public.mgr_pay(uuid, bigint, text, uuid) from public, anon, authenticated;

-- The result of a match, its effects on the players and the money of the round, in one transaction.
-- p_money: [{ club_id, reason, amount }] for the two clubs of the match (real clubs only).
create or replace function public.mgr_play_match_v2(
  p_match       uuid,
  p_home_goals  smallint,
  p_away_goals  smallint,
  p_events      jsonb,
  p_home_lineup jsonb,
  p_away_lineup jsonb,
  p_effects     jsonb,
  p_money       jsonb
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_home  uuid;
  v_away  uuid;
  v_entry jsonb;
begin
  if not public.mgr_play_match(p_match, p_home_goals, p_away_goals, p_events, p_home_lineup, p_away_lineup, p_effects) then
    return false;
  end if;
  select home_club_id, away_club_id into v_home, v_away from public.mgr_matches where id = p_match;
  if jsonb_typeof(p_money) = 'array' then
    for v_entry in select * from jsonb_array_elements(p_money) loop
      if (v_entry ->> 'club_id')::uuid not in (v_home, v_away)
         or (v_entry ->> 'reason') not in ('base', 'tickets', 'premium', 'wages') then
        raise exception 'manager.money_invalid' using errcode = 'P0001';
      end if;
      perform public.mgr_pay((v_entry ->> 'club_id')::uuid, (v_entry ->> 'amount')::bigint, v_entry ->> 'reason', p_match);
    end loop;
  end if;
  return true;
end;
$$;

-- The end of a season now also pays the prizes: 4000 * (21 - place) / 20 to the real clubs, the
-- place from points, goal difference, goals scored, then the name (the same order as the table).
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

  -- The prizes of the final table: the place counts all 20 clubs, bots included; bots are paid nothing.
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
      select t.club, c.user_id,
             row_number() over (order by t.pts desc, t.gf - t.ga desc, t.gf desc, c.name) as place
      from t join public.mgr_clubs c on c.id = t.club
    )
    select club, place from ranked where user_id is not null
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

-- The monthly pool of free players of a league: the unsold ones of the last month go, 30 new come.
-- p_players: [{first_name, last_name, position, age, ovr, potential, attributes}]. Once a month.
create or replace function public.mgr_add_pool(p_league uuid, p_month text, p_players jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_item   jsonb;
  v_attr   record;
  v_player uuid;
begin
  if not exists (select 1 from public.mgr_leagues where id = p_league and pool_month is distinct from p_month) then
    return false;
  end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) <> 30 then
    raise exception 'manager.pool_invalid' using errcode = 'P0001';
  end if;

  delete from public.mgr_players where pool_league_id = p_league and club_id is null;
  for v_item in select * from jsonb_array_elements(p_players) loop
    insert into public.mgr_players (club_id, pool_league_id, first_name, last_name, position, citizenship, age, ovr)
    values (null, p_league, v_item ->> 'first_name', v_item ->> 'last_name', v_item ->> 'position', 'BY',
            (v_item ->> 'age')::smallint, (v_item ->> 'ovr')::smallint)
    returning id into v_player;
    for v_attr in select key, value from jsonb_each_text(v_item -> 'attributes') loop
      insert into public.mgr_player_attributes (player_id, attribute, value)
      values (v_player, v_attr.key, v_attr.value::smallint);
    end loop;
    insert into public.mgr_player_hidden (player_id, potential)
    values (v_player, (v_item ->> 'potential')::smallint);
  end loop;
  update public.mgr_leagues set pool_month = p_month where id = p_league;
  return true;
end;
$$;

-- A club buys a free player of its league's pool at his nominal value. Refused while the market is
-- closed (fewer than 10 played matches), with a squad of 23, with less money than the price, and in debt.
-- Returns the budget after the purchase.
create or replace function public.mgr_buy_free_agent(p_user uuid, p_player uuid)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_club   record;
  v_player record;
  v_price  integer;
  v_played integer;
  v_size   integer;
begin
  select id, league_id, budget into v_club from public.mgr_clubs where user_id = p_user for update;
  if not found then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  select count(*) into v_played from public.mgr_matches
  where kind = 'league' and status = 'finished' and v_club.id in (home_club_id, away_club_id);
  if v_club.league_id is null or v_played < 10 then
    raise exception 'manager.market_closed' using errcode = 'P0001';
  end if;

  select * into v_player from public.mgr_players
  where id = p_player and club_id is null and pool_league_id = v_club.league_id for update;
  if not found then
    raise exception 'manager.player_unavailable' using errcode = 'P0001';
  end if;
  select count(*) into v_size from public.mgr_players where club_id = v_club.id;
  if v_size >= 23 then
    raise exception 'manager.squad_full' using errcode = 'P0001';
  end if;

  v_price := public.mgr_nominal(v_player.ovr, v_player.age);
  if v_club.budget < 0 or v_club.budget < v_price then
    raise exception 'manager.no_money' using errcode = 'P0001';
  end if;

  update public.mgr_players set club_id = v_club.id, pool_league_id = null where id = p_player;
  return public.mgr_pay(v_club.id, -v_price, 'purchase', p_player);
end;
$$;

revoke execute on function public.mgr_play_match_v2(uuid, smallint, smallint, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.mgr_add_pool(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.mgr_buy_free_agent(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mgr_play_match_v2(uuid, smallint, smallint, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.mgr_add_pool(uuid, text, jsonb) to service_role;
grant execute on function public.mgr_buy_free_agent(uuid, uuid) to service_role;
