-- Football manager, stage 4, part 2 (D-136, docs/MANAGER.md): the market between clubs. An auction
-- of players (a lot, bids; the deals are made once a day, at the 10:00 Moscow tick), an exchange of
-- players between two clubs (a trade, with a payment on top if wanted), the "one deal with one club
-- per season" log, the week during which a bought or exchanged player cannot be put up again, and
-- the contracts of the players (a term in seasons and a wage fixed when it is signed).
-- Backward compatible: new tables, a new column with no default, a wider list of ledger reasons and
-- new functions; mgr_buy_free_agent only gets one more line (the week mark).
--
-- Money and players move ONLY through the functions below (security definer, the service role
-- alone may call them), each in one transaction. No money is held while an auction runs: the winner
-- pays when the lot is settled, and a bid that cannot be paid then (no money, no room in the squad) is struck
-- out and the next best bid is tried. Nothing is printed: the buyer pays the whole price, the seller
-- gets it minus the tax (10%) and never more than twice the nominal value, the rest burns.

alter table public.mgr_players add column tradable_after timestamptz;
comment on column public.mgr_players.tradable_after is 'A bought or exchanged player cannot be put up for sale or exchanged before this moment.';

-- The contract: the last season it covers (inclusive) and the wage of a round, fixed at signing.
alter table public.mgr_players add column wage integer not null default 0 check (wage >= 0);
alter table public.mgr_players add column contract_until smallint;
-- The season in which the player was last offered a new contract (one offer a season).
alter table public.mgr_players add column contract_offer_season smallint;
comment on column public.mgr_players.contract_until is 'The last season the contract covers, the player leaves for the pool after it.';
comment on column public.mgr_players.wage is 'The wage of a round of the league, fixed when the contract is signed (0.5% of the nominal value then).';

alter table public.mgr_transactions drop constraint mgr_transactions_reason_check;
alter table public.mgr_transactions add constraint mgr_transactions_reason_check
  check (reason in ('base', 'tickets', 'premium', 'wages', 'prize', 'purchase', 'sale', 'tax', 'trade', 'penalty'));

-- ---- tables ------------------------------------------------------------------------------------

create table public.mgr_auctions (
  id               uuid primary key default gen_random_uuid(),
  league_id        uuid not null references public.mgr_leagues (id) on delete cascade,
  player_id        uuid not null references public.mgr_players (id) on delete cascade,
  seller_club_id   uuid not null references public.mgr_clubs (id) on delete cascade,
  start_price      bigint not null check (start_price > 0),
  step_percent     smallint not null check (step_percent in (10, 20, 30)),
  -- The nominal value when the lot was put up: the cap of the payout is counted from it.
  nominal          bigint not null check (nominal > 0),
  status           text not null default 'open' check (status in ('open', 'sold', 'unsold', 'cancelled')),
  created_at       timestamptz not null default now(),
  -- The tick (10:00 Moscow time) at which the lot is settled: the first one at least 12 hours after it was put up.
  ends_at          timestamptz not null,
  bid_count        integer not null default 0,
  best_bid         bigint,
  best_club_id     uuid references public.mgr_clubs (id) on delete set null,
  buyer_club_id    uuid references public.mgr_clubs (id) on delete set null,
  final_price      bigint,
  closed_at        timestamptz
);
create unique index mgr_auctions_one_open_per_player on public.mgr_auctions (player_id) where status = 'open';
create index mgr_auctions_due_idx on public.mgr_auctions (ends_at) where status = 'open';
create index mgr_auctions_league_idx on public.mgr_auctions (league_id, status);
comment on table public.mgr_auctions is 'A lot: a player put up for sale by a club of the league.';

create table public.mgr_bids (
  id         bigint generated always as identity primary key,
  auction_id uuid not null references public.mgr_auctions (id) on delete cascade,
  club_id    uuid not null references public.mgr_clubs (id) on delete cascade,
  amount     bigint not null check (amount > 0),
  -- struck: it could not be paid when the auction closed; lost: someone else won.
  status     text not null default 'active' check (status in ('active', 'won', 'lost', 'struck')),
  created_at timestamptz not null default now()
);
create index mgr_bids_auction_idx on public.mgr_bids (auction_id, amount desc);
create index mgr_bids_club_idx on public.mgr_bids (club_id);

create table public.mgr_trades (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references public.mgr_leagues (id) on delete cascade,
  from_club_id uuid not null references public.mgr_clubs (id) on delete cascade,
  to_club_id   uuid not null references public.mgr_clubs (id) on delete cascade,
  give_ids     uuid[] not null check (cardinality(give_ids) between 1 and 3),
  take_ids     uuid[] not null check (cardinality(take_ids) between 1 and 3),
  -- The money on top: positive, the proposer pays; negative, the proposer gets it.
  cash         bigint not null default 0,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '48 hours',
  resolved_at  timestamptz,
  check (from_club_id <> to_club_id)
);
create index mgr_trades_from_idx on public.mgr_trades (from_club_id, status);
create index mgr_trades_to_idx on public.mgr_trades (to_club_id, status);
create index mgr_trades_due_idx on public.mgr_trades (expires_at) where status = 'pending';

-- A deal between two clubs in a season: at most one (a protection against two accounts of one person).
create table public.mgr_deals (
  club_a     uuid not null references public.mgr_clubs (id) on delete cascade,
  club_b     uuid not null references public.mgr_clubs (id) on delete cascade,
  season     smallint not null,
  kind       text not null check (kind in ('auction', 'trade')),
  ref        uuid not null,
  created_at timestamptz not null default now(),
  primary key (club_a, club_b, season),
  check (club_a < club_b)
);
create index mgr_deals_b_idx on public.mgr_deals (club_b);

alter table public.mgr_auctions enable row level security;
alter table public.mgr_bids enable row level security;
alter table public.mgr_trades enable row level security;
alter table public.mgr_deals enable row level security;

create policy mgr_auctions_select on public.mgr_auctions for select to authenticated
  using (league_id = (select public.mgr_my_league()));
create policy mgr_bids_select on public.mgr_bids for select to authenticated
  using (exists (select 1 from public.mgr_clubs c where c.id = club_id and c.user_id = (select auth.uid())));
create policy mgr_trades_select on public.mgr_trades for select to authenticated
  using (exists (
    select 1 from public.mgr_clubs c
    where c.id in (from_club_id, to_club_id) and c.user_id = (select auth.uid())
  ));
create policy mgr_deals_select on public.mgr_deals for select to authenticated
  using (exists (
    select 1 from public.mgr_clubs c
    where c.id in (club_a, club_b) and c.user_id = (select auth.uid())
  ));
revoke all on public.mgr_auctions, public.mgr_bids, public.mgr_trades, public.mgr_deals from anon, authenticated;
grant select on public.mgr_auctions, public.mgr_bids, public.mgr_trades, public.mgr_deals to authenticated;

-- ---- helpers (inside other functions only) -----------------------------------------------------

-- The market of a club is open: it is in a league and has played 10 league matches.
create or replace function public.mgr_market_open(p_club uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.mgr_clubs where id = p_club and league_id is not null)
    and (select count(*) from public.mgr_matches
         where kind = 'league' and status = 'finished' and p_club in (home_club_id, away_club_id)) >= 10;
$$;

-- Has the pair of clubs already made a deal this season?
create or replace function public.mgr_deal_done(p_a uuid, p_b uuid, p_season smallint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.mgr_deals
    where club_a = least(p_a, p_b) and club_b = greatest(p_a, p_b) and season = p_season
  );
$$;

-- Locks two clubs in one fixed order (the id), so two deals never wait for each other in a circle.
create or replace function public.mgr_lock_clubs(p_a uuid, p_b uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.mgr_clubs where id in (p_a, p_b) order by id for update;
end;
$$;

-- The first season a new contract covers: this one, or the next while the league is in its preseason.
create or replace function public.mgr_contract_start(p_league uuid)
returns smallint
language sql stable security definer set search_path = ''
as $$
  select coalesce((select case when phase = 'preseason' then season + 1 else season end
                   from public.mgr_leagues where id = p_league), 1)::smallint;
$$;

-- Signs a contract of p_seasons seasons with a player of a club: the wage is 0.5% of his nominal
-- value now and stays so until the contract ends.
create or replace function public.mgr_sign(p_player uuid, p_seasons integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_league uuid;
begin
  select coalesce(p.pool_league_id, c.league_id) into v_league
  from public.mgr_players p left join public.mgr_clubs c on c.id = p.club_id where p.id = p_player;
  update public.mgr_players
  set wage = round(public.mgr_nominal(ovr, age) * 0.005),
      contract_until = public.mgr_contract_start(v_league) + p_seasons - 1
  where id = p_player;
end;
$$;

-- The rounds of the league left on the contract: what is left of this season plus whole seasons after it.
create or replace function public.mgr_contract_rounds(p_player uuid)
returns integer
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_player record;
  v_league record;
  v_played integer;
begin
  select p.contract_until, p.club_id, c.league_id into v_player
  from public.mgr_players p join public.mgr_clubs c on c.id = p.club_id where p.id = p_player;
  if not found or v_player.contract_until is null then
    return 0;
  end if;
  select season into v_league from public.mgr_leagues where id = v_player.league_id;
  select count(*) into v_played from public.mgr_matches
  where kind = 'league' and status = 'finished' and season = v_league.season
    and v_player.club_id in (home_club_id, away_club_id);
  return greatest(0, (38 - v_played) + 38 * (v_player.contract_until - v_league.season));
end;
$$;

-- Moves a player to a club, with the week mark and a new contract of 2 seasons.
create or replace function public.mgr_hand_over(p_player uuid, p_club uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.mgr_players
  set club_id = p_club, pool_league_id = null, training_focus = null,
      tradable_after = now() + interval '7 days'
  where id = p_player;
  perform public.mgr_sign(p_player, 2);
end;
$$;

revoke execute on function public.mgr_market_open(uuid) from public, anon, authenticated;
revoke execute on function public.mgr_deal_done(uuid, uuid, smallint) from public, anon, authenticated;
revoke execute on function public.mgr_lock_clubs(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mgr_hand_over(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mgr_contract_start(uuid) from public, anon, authenticated;
revoke execute on function public.mgr_sign(uuid, integer) from public, anon, authenticated;
revoke execute on function public.mgr_contract_rounds(uuid) from public, anon, authenticated;

-- A free player bought from the pool gets the week mark too (the same rule: bought, not for sale for a week).
create or replace function public.mgr_buy_free_agent(p_user uuid, p_player uuid)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_club   record;
  v_player record;
  v_price  integer;
  v_size   integer;
begin
  select id, league_id, budget into v_club from public.mgr_clubs where user_id = p_user for update;
  if not found then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  if not public.mgr_market_open(v_club.id) then
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

  perform public.mgr_hand_over(p_player, v_club.id);
  return public.mgr_pay(v_club.id, -v_price, 'purchase', p_player);
end;
$$;

-- ---- auction -----------------------------------------------------------------------------------

-- Puts a player of my club up for sale. Price: from half to twice the nominal value; step 10/20/30%.
-- The squad must keep 17 players after all my open lots are sold; at most 5 open lots.
create or replace function public.mgr_list_player(p_user uuid, p_player uuid, p_price bigint, p_step smallint)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_club    record;
  v_player  record;
  v_nominal integer;
  v_size    integer;
  v_lots    integer;
  v_id      uuid;
  v_tick    timestamptz;
begin
  select id, league_id into v_club from public.mgr_clubs where user_id = p_user for update;
  if not found then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  if not public.mgr_market_open(v_club.id) then
    raise exception 'manager.market_closed' using errcode = 'P0001';
  end if;
  if p_step not in (10, 20, 30) then
    raise exception 'manager.step_invalid' using errcode = 'P0001';
  end if;

  select * into v_player from public.mgr_players where id = p_player and club_id = v_club.id for update;
  if not found or exists (select 1 from public.mgr_auctions where player_id = p_player and status = 'open') then
    raise exception 'manager.player_unavailable' using errcode = 'P0001';
  end if;
  if v_player.tradable_after is not null and v_player.tradable_after > now() then
    raise exception 'manager.player_locked' using errcode = 'P0001';
  end if;
  -- A player whose contract ends in under half a season, or who retires, is not for sale.
  if v_player.retire_after_season or public.mgr_contract_rounds(p_player) < 19 then
    raise exception 'manager.contract_ending' using errcode = 'P0001';
  end if;

  v_nominal := public.mgr_nominal(v_player.ovr, v_player.age);
  if p_price < round(v_nominal * 0.5) or p_price > round(v_nominal * 2.0) then
    raise exception 'manager.price_invalid' using errcode = 'P0001';
  end if;

  select count(*) into v_size from public.mgr_players where club_id = v_club.id;
  select count(*) into v_lots from public.mgr_auctions where seller_club_id = v_club.id and status = 'open';
  if v_lots >= 5 then
    raise exception 'manager.lots_limit' using errcode = 'P0001';
  end if;
  if v_size - v_lots - 1 < 17 then
    raise exception 'manager.squad_min' using errcode = 'P0001';
  end if;

  -- Deals are made once a day at 10:00 Moscow time (07:00 UTC): the first tick at least 12 hours from now.
  v_tick := (date_trunc('day', (now() + interval '12 hours') at time zone 'utc') + interval '7 hours') at time zone 'utc';
  if v_tick < now() + interval '12 hours' then
    v_tick := v_tick + interval '1 day';
  end if;
  insert into public.mgr_auctions (league_id, player_id, seller_club_id, start_price, step_percent, nominal, ends_at)
  values (v_club.league_id, p_player, v_club.id, p_price, p_step, v_nominal, v_tick)
  returning id into v_id;
  return v_id;
end;
$$;

-- Takes a lot off the market; only the seller, and only while nobody has bid.
create or replace function public.mgr_cancel_auction(p_user uuid, p_auction uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_auction record;
begin
  select a.* into v_auction from public.mgr_auctions a
  join public.mgr_clubs c on c.id = a.seller_club_id
  where a.id = p_auction and c.user_id = p_user for update of a;
  if not found then
    raise exception 'manager.auction_unknown' using errcode = 'P0001';
  end if;
  if v_auction.status <> 'open' then
    return false;
  end if;
  if v_auction.bid_count > 0 then
    raise exception 'manager.has_bids' using errcode = 'P0001';
  end if;
  update public.mgr_auctions set status = 'cancelled', closed_at = now() where id = p_auction;
  return true;
end;
$$;

-- A bid. The least: the start price, then the best bid plus the step. No money is held now; it must
-- be there when the lot is settled. Returns the tick at which it is settled.
create or replace function public.mgr_place_bid(p_user uuid, p_auction uuid, p_amount bigint)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_club    record;
  v_auction record;
  v_min     bigint;
  v_season  smallint;
begin
  select id, league_id, budget into v_club from public.mgr_clubs where user_id = p_user;
  if not found then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  select * into v_auction from public.mgr_auctions where id = p_auction for update;
  if not found or v_auction.league_id is distinct from v_club.league_id then
    raise exception 'manager.auction_unknown' using errcode = 'P0001';
  end if;
  perform 1 from public.mgr_clubs where id = v_club.id for update;
  select budget into v_club.budget from public.mgr_clubs where id = v_club.id;

  if v_auction.status <> 'open' or v_auction.ends_at <= now() then
    raise exception 'manager.auction_closed' using errcode = 'P0001';
  end if;
  if v_auction.seller_club_id = v_club.id then
    raise exception 'manager.own_auction' using errcode = 'P0001';
  end if;
  if not public.mgr_market_open(v_club.id) then
    raise exception 'manager.market_closed' using errcode = 'P0001';
  end if;
  if v_auction.best_club_id = v_club.id then
    raise exception 'manager.bid_leading' using errcode = 'P0001';
  end if;
  if v_club.budget < 0 or v_club.budget < p_amount then
    raise exception 'manager.no_money' using errcode = 'P0001';
  end if;
  select season into v_season from public.mgr_leagues where id = v_auction.league_id;
  if public.mgr_deal_done(v_club.id, v_auction.seller_club_id, v_season) then
    raise exception 'manager.deal_limit' using errcode = 'P0001';
  end if;

  if v_auction.bid_count = 0 then
    v_min := v_auction.start_price;
  else
    v_min := v_auction.best_bid + greatest(1, ceil(v_auction.best_bid * v_auction.step_percent / 100.0)::bigint);
  end if;
  if p_amount < v_min then
    raise exception 'manager.bid_too_low' using errcode = 'P0001';
  end if;

  -- No extension: the lot is settled at its tick whatever the bids.
  insert into public.mgr_bids (auction_id, club_id, amount) values (p_auction, v_club.id, p_amount);
  update public.mgr_auctions
  set bid_count = bid_count + 1, best_bid = p_amount, best_club_id = v_club.id
  where id = p_auction;
  return v_auction.ends_at;
end;
$$;

-- The ids of the lots whose time is up (by the clock of the database).
create or replace function public.mgr_due_auctions()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.mgr_auctions where status = 'open' and ends_at <= now() order by ends_at;
$$;

-- Closes one lot whose time is up, once. Returns 'sold', 'unsold' or 'cancelled', null if there was
-- nothing to close (not due, or already closed by another runner).
-- The bids are tried from the highest. A bid is struck out when its club cannot pay, has no room in
-- the squad (23) or has already made a deal with the seller this season; the next one is tried.
create or replace function public.mgr_settle_auction(p_auction uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_auction record;
  v_bid     record;
  v_season  smallint;
  v_buyer   record;
  v_seller  record;
  v_size    integer;
  v_tax     bigint;
  v_payout  bigint;
begin
  select * into v_auction from public.mgr_auctions where id = p_auction for update;
  if not found or v_auction.status <> 'open' or v_auction.ends_at > now() then
    return null;
  end if;
  select season into v_season from public.mgr_leagues where id = v_auction.league_id;

  -- The player must still be the seller's, and the seller must keep 17.
  select count(*) into v_size from public.mgr_players where club_id = v_auction.seller_club_id;
  if v_size <= 17 or not exists (
    select 1 from public.mgr_players where id = v_auction.player_id and club_id = v_auction.seller_club_id
  ) then
    update public.mgr_auctions set status = 'cancelled', closed_at = now() where id = p_auction;
    return 'cancelled';
  end if;

  for v_bid in
    select b.id, b.club_id, b.amount from public.mgr_bids b
    where b.auction_id = p_auction and b.status = 'active'
    order by b.amount desc, b.id
  loop
    perform public.mgr_lock_clubs(v_bid.club_id, v_auction.seller_club_id);
    select budget into v_buyer from public.mgr_clubs where id = v_bid.club_id;
    select count(*) into v_size from public.mgr_players where club_id = v_bid.club_id;
    if v_buyer.budget < 0 or v_buyer.budget < v_bid.amount or v_size >= 23
       or public.mgr_deal_done(v_bid.club_id, v_auction.seller_club_id, v_season)
       or not exists (select 1 from public.mgr_clubs where id = v_bid.club_id) then
      update public.mgr_bids set status = 'struck' where auction_id = p_auction and club_id = v_bid.club_id and status = 'active';
      continue;
    end if;

    -- The tax and the cap: the same numbers as sellerProceeds in src/lib/manager/economy.ts.
    v_tax := round(v_bid.amount * 0.1);
    v_payout := least(v_bid.amount - v_tax, round(v_auction.nominal * 2.0));
    perform public.mgr_hand_over(v_auction.player_id, v_bid.club_id);
    perform public.mgr_pay(v_bid.club_id, -v_bid.amount, 'purchase', v_auction.player_id);
    perform public.mgr_pay(v_auction.seller_club_id, v_bid.amount, 'sale', v_auction.player_id);
    perform public.mgr_pay(v_auction.seller_club_id, -(v_bid.amount - v_payout), 'tax', v_auction.player_id);
    insert into public.mgr_deals (club_a, club_b, season, kind, ref)
    values (least(v_bid.club_id, v_auction.seller_club_id), greatest(v_bid.club_id, v_auction.seller_club_id),
            v_season, 'auction', p_auction);
    update public.mgr_bids set status = 'won' where id = v_bid.id;
    update public.mgr_bids set status = 'lost' where auction_id = p_auction and status = 'active' and id <> v_bid.id;
    update public.mgr_auctions
    set status = 'sold', buyer_club_id = v_bid.club_id, final_price = v_bid.amount, closed_at = now()
    where id = p_auction;
    return 'sold';
  end loop;

  update public.mgr_auctions set status = 'unsold', closed_at = now() where id = p_auction;
  return 'unsold';
end;
$$;

-- ---- trade -------------------------------------------------------------------------------------

-- My club offers players for players of another club of the league, with money on top
-- (p_cash > 0: I pay; < 0: I get). The money can be at most twice the nominal value of the players
-- the payer receives; the one who gets it pays the 10% tax. Lives 48 hours.
create or replace function public.mgr_propose_trade(
  p_user uuid, p_to_club uuid, p_give uuid[], p_take uuid[], p_cash bigint
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_club    record;
  v_other   record;
  v_season  smallint;
  v_size    integer;
  v_count   integer;
  v_pending integer;
  v_cap     bigint;
  v_id      uuid;
begin
  select id, league_id, budget into v_club from public.mgr_clubs where user_id = p_user;
  if not found then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  if not public.mgr_market_open(v_club.id) then
    raise exception 'manager.market_closed' using errcode = 'P0001';
  end if;
  select id, user_id, league_id into v_other from public.mgr_clubs where id = p_to_club;
  if not found or v_other.user_id is null or v_other.id = v_club.id or v_other.league_id is distinct from v_club.league_id then
    raise exception 'manager.trade_invalid' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_give), 0) not between 1 and 3 or coalesce(cardinality(p_take), 0) not between 1 and 3
     or (select count(distinct x) from unnest(p_give) x) <> cardinality(p_give)
     or (select count(distinct x) from unnest(p_take) x) <> cardinality(p_take) then
    raise exception 'manager.trade_invalid' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.mgr_players
  where id = any (p_give) and club_id = v_club.id and (tradable_after is null or tradable_after <= now());
  if v_count <> cardinality(p_give) then
    raise exception 'manager.player_unavailable' using errcode = 'P0001';
  end if;
  select count(*) into v_count from public.mgr_players where id = any (p_take) and club_id = v_other.id;
  if v_count <> cardinality(p_take) then
    raise exception 'manager.player_unavailable' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.mgr_auctions where player_id = any (p_give || p_take) and status = 'open') then
    raise exception 'manager.player_unavailable' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.mgr_players where id = any (p_give || p_take) and (retire_after_season or public.mgr_contract_rounds(id) < 19)) then
    raise exception 'manager.contract_ending' using errcode = 'P0001';
  end if;

  select count(*) into v_size from public.mgr_players where club_id = v_club.id;
  if v_size - cardinality(p_give) + cardinality(p_take) not between 17 and 23 then
    raise exception 'manager.squad_size' using errcode = 'P0001';
  end if;
  select season into v_season from public.mgr_leagues where id = v_club.league_id;
  if public.mgr_deal_done(v_club.id, v_other.id, v_season) then
    raise exception 'manager.deal_limit' using errcode = 'P0001';
  end if;

  if p_cash > 0 then
    -- I pay: at most twice the nominal value of what I get.
    select coalesce(sum(public.mgr_nominal(ovr, age)), 0) * 2 into v_cap from public.mgr_players where id = any (p_take);
    if p_cash > v_cap or v_club.budget < 0 or v_club.budget < p_cash then
      raise exception 'manager.cash_invalid' using errcode = 'P0001';
    end if;
  elsif p_cash < 0 then
    select coalesce(sum(public.mgr_nominal(ovr, age)), 0) * 2 into v_cap from public.mgr_players where id = any (p_give);
    if -p_cash > v_cap then
      raise exception 'manager.cash_invalid' using errcode = 'P0001';
    end if;
  end if;

  select count(*) into v_pending from public.mgr_trades where from_club_id = v_club.id and status = 'pending';
  if v_pending >= 5 then
    raise exception 'manager.lots_limit' using errcode = 'P0001';
  end if;

  insert into public.mgr_trades (league_id, from_club_id, to_club_id, give_ids, take_ids, cash)
  values (v_club.league_id, v_club.id, v_other.id, p_give, p_take, p_cash)
  returning id into v_id;
  return v_id;
end;
$$;

-- The other club accepts: everything is checked again, then the players change clubs together
-- with the money, in one transaction. Raises manager.trade_closed for a trade that is not pending
-- or has run out of time (the sweep marks it expired).
create or replace function public.mgr_accept_trade(p_user uuid, p_trade uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_trade  record;
  v_me     record;
  v_from   record;
  v_season smallint;
  v_size_f integer;
  v_size_t integer;
  v_count  integer;
  v_player uuid;
  v_payer  uuid;
  v_payee  uuid;
  v_amount bigint;
  v_tax    bigint;
  v_cap    bigint;
begin
  select * into v_trade from public.mgr_trades where id = p_trade for update;
  if not found then
    raise exception 'manager.trade_unknown' using errcode = 'P0001';
  end if;
  select id, budget into v_me from public.mgr_clubs where user_id = p_user;
  if not found or v_me.id <> v_trade.to_club_id then
    raise exception 'manager.trade_unknown' using errcode = 'P0001';
  end if;
  if v_trade.status <> 'pending' or v_trade.expires_at <= now() then
    raise exception 'manager.trade_closed' using errcode = 'P0001';
  end if;

  perform public.mgr_lock_clubs(v_trade.from_club_id, v_trade.to_club_id);
  select id, budget into v_from from public.mgr_clubs where id = v_trade.from_club_id;
  select budget into v_me.budget from public.mgr_clubs where id = v_me.id;
  if not public.mgr_market_open(v_me.id) or not public.mgr_market_open(v_from.id) then
    raise exception 'manager.market_closed' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.mgr_players
  where id = any (v_trade.give_ids) and club_id = v_trade.from_club_id and (tradable_after is null or tradable_after <= now());
  if v_count <> cardinality(v_trade.give_ids) then
    raise exception 'manager.player_unavailable' using errcode = 'P0001';
  end if;
  select count(*) into v_count from public.mgr_players
  where id = any (v_trade.take_ids) and club_id = v_trade.to_club_id and (tradable_after is null or tradable_after <= now());
  if v_count <> cardinality(v_trade.take_ids) then
    raise exception 'manager.player_unavailable' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.mgr_auctions where player_id = any (v_trade.give_ids || v_trade.take_ids) and status = 'open') then
    raise exception 'manager.player_unavailable' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.mgr_players where id = any (v_trade.give_ids || v_trade.take_ids) and (retire_after_season or public.mgr_contract_rounds(id) < 19)) then
    raise exception 'manager.contract_ending' using errcode = 'P0001';
  end if;

  select count(*) into v_size_f from public.mgr_players where club_id = v_trade.from_club_id;
  select count(*) into v_size_t from public.mgr_players where club_id = v_trade.to_club_id;
  if v_size_f - cardinality(v_trade.give_ids) + cardinality(v_trade.take_ids) not between 17 and 23
     or v_size_t + cardinality(v_trade.give_ids) - cardinality(v_trade.take_ids) not between 17 and 23 then
    raise exception 'manager.squad_size' using errcode = 'P0001';
  end if;
  select season into v_season from public.mgr_leagues where id = v_trade.league_id;
  if public.mgr_deal_done(v_trade.from_club_id, v_trade.to_club_id, v_season) then
    raise exception 'manager.deal_limit' using errcode = 'P0001';
  end if;

  if v_trade.cash <> 0 then
    if v_trade.cash > 0 then
      v_payer := v_trade.from_club_id; v_payee := v_trade.to_club_id; v_amount := v_trade.cash;
      select coalesce(sum(public.mgr_nominal(ovr, age)), 0) * 2 into v_cap from public.mgr_players where id = any (v_trade.take_ids);
    else
      v_payer := v_trade.to_club_id; v_payee := v_trade.from_club_id; v_amount := -v_trade.cash;
      select coalesce(sum(public.mgr_nominal(ovr, age)), 0) * 2 into v_cap from public.mgr_players where id = any (v_trade.give_ids);
    end if;
    if v_amount > v_cap
       or (select budget from public.mgr_clubs where id = v_payer) < 0
       or (select budget from public.mgr_clubs where id = v_payer) < v_amount then
      raise exception 'manager.no_money' using errcode = 'P0001';
    end if;
  end if;

  foreach v_player in array v_trade.give_ids loop
    perform public.mgr_hand_over(v_player, v_trade.to_club_id);
  end loop;
  foreach v_player in array v_trade.take_ids loop
    perform public.mgr_hand_over(v_player, v_trade.from_club_id);
  end loop;
  if v_trade.cash <> 0 then
    v_tax := round(v_amount * 0.1);
    perform public.mgr_pay(v_payer, -v_amount, 'trade', p_trade);
    perform public.mgr_pay(v_payee, v_amount, 'trade', p_trade);
    perform public.mgr_pay(v_payee, -v_tax, 'tax', p_trade);
  end if;
  insert into public.mgr_deals (club_a, club_b, season, kind, ref)
  values (least(v_trade.from_club_id, v_trade.to_club_id), greatest(v_trade.from_club_id, v_trade.to_club_id),
          v_season, 'trade', p_trade);
  update public.mgr_trades set status = 'accepted', resolved_at = now() where id = p_trade;
  -- Other offers that included a player who just moved can no longer be accepted.
  update public.mgr_trades set status = 'cancelled', resolved_at = now()
  where status = 'pending' and id <> p_trade
    and (give_ids || take_ids) && (v_trade.give_ids || v_trade.take_ids);
end;
$$;

-- The receiving club declines, or the proposing club withdraws. p_action: 'decline' | 'cancel'.
create or replace function public.mgr_close_trade(p_user uuid, p_trade uuid, p_action text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_trade record;
  v_club  uuid;
begin
  if p_action not in ('decline', 'cancel') then
    raise exception 'manager.trade_invalid' using errcode = 'P0001';
  end if;
  select * into v_trade from public.mgr_trades where id = p_trade for update;
  if not found then
    raise exception 'manager.trade_unknown' using errcode = 'P0001';
  end if;
  select id into v_club from public.mgr_clubs where user_id = p_user;
  if v_club is null
     or (p_action = 'decline' and v_club <> v_trade.to_club_id)
     or (p_action = 'cancel' and v_club <> v_trade.from_club_id) then
    raise exception 'manager.trade_unknown' using errcode = 'P0001';
  end if;
  if v_trade.status <> 'pending' then
    return false;
  end if;
  update public.mgr_trades
  set status = (case when p_action = 'decline' then 'declined' else 'cancelled' end), resolved_at = now()
  where id = p_trade;
  return true;
end;
$$;

-- The offers whose 48 hours are over become expired; safe to call again. Returns how many.
create or replace function public.mgr_expire_trades()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.mgr_trades set status = 'expired', resolved_at = now()
  where status = 'pending' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---- contracts ---------------------------------------------------------------------------------

-- A new player gets a wage and a contract. The starting players of a club (made before it has a
-- league, or in the first season) get 1 to 3 seasons, spread by their id, so the squads do not melt
-- away all at once; the others (the pool, the academy) get 2 seasons.
create or replace function public.mgr_player_defaults()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_league uuid;
  v_season smallint;
  v_phase  text;
  v_terms  integer := 2;
begin
  if new.wage = 0 then
    new.wage := round(public.mgr_nominal(new.ovr, new.age) * 0.005);
  end if;
  if new.contract_until is null then
    v_league := coalesce(new.pool_league_id, (select league_id from public.mgr_clubs where id = new.club_id));
    select season, phase into v_season, v_phase from public.mgr_leagues where id = v_league;
    if new.club_id is not null and (v_league is null or (v_season = 1 and v_phase = 'season')) then
      v_terms := 1 + abs(hashtext(new.id::text)) % 3;
    end if;
    new.contract_until := public.mgr_contract_start(v_league) + v_terms - 1;
  end if;
  return new;
end;
$$;
create trigger mgr_players_defaults before insert on public.mgr_players
  for each row execute function public.mgr_player_defaults();

-- A club that joins a running league: the contracts of its players (counted as if from season 1)
-- move to the current season.
create or replace function public.mgr_club_joined()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_shift integer;
begin
  v_shift := public.mgr_contract_start(new.league_id) - 1;
  if v_shift > 0 then
    update public.mgr_players set contract_until = contract_until + v_shift where club_id = new.id;
  end if;
  return new;
end;
$$;
create trigger mgr_clubs_joined after update of league_id on public.mgr_clubs
  for each row when (old.league_id is null and new.league_id is not null)
  execute function public.mgr_club_joined();

-- The players that exist now: the wage of today, 1 to 3 seasons from the current one.
update public.mgr_players p
set wage = round(public.mgr_nominal(p.ovr, p.age) * 0.005),
    contract_until = public.mgr_contract_start(coalesce(p.pool_league_id, (select c.league_id from public.mgr_clubs c where c.id = p.club_id)))
                     + (case when p.club_id is not null then abs(hashtext(p.id::text)) % 3 else 1 end)
where p.contract_until is null;

-- The club offers a new contract. Allowed when the old one has from half a season to 2 seasons left;
-- one offer a season for a player. He may refuse (10% with morale 60+, 40% at 40-59, 70% below):
-- then the old contract goes on. The new one starts from the end of the old one, p_seasons (1 to 3)
-- long, with the wage of today. Returns 'accepted' or 'refused'.
create or replace function public.mgr_extend_contract(p_user uuid, p_player uuid, p_seasons integer)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_club   record;
  v_player record;
  v_season smallint;
  v_rounds integer;
  v_refuse numeric;
begin
  select id, league_id into v_club from public.mgr_clubs where user_id = p_user for update;
  if not found then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  if p_seasons not between 1 and 3 then
    raise exception 'manager.contract_invalid' using errcode = 'P0001';
  end if;
  select * into v_player from public.mgr_players where id = p_player and club_id = v_club.id for update;
  if not found then
    raise exception 'manager.player_unavailable' using errcode = 'P0001';
  end if;
  select season into v_season from public.mgr_leagues where id = v_club.league_id;
  if v_player.contract_offer_season is not distinct from v_season then
    raise exception 'manager.offer_used' using errcode = 'P0001';
  end if;
  v_rounds := public.mgr_contract_rounds(p_player);
  if v_rounds < 19 or v_rounds > 76 then
    raise exception 'manager.contract_invalid' using errcode = 'P0001';
  end if;

  update public.mgr_players set contract_offer_season = v_season where id = p_player;
  v_refuse := case when v_player.morale >= 60 then 0.1 when v_player.morale >= 40 then 0.4 else 0.7 end;
  if random() < v_refuse then
    return 'refused';
  end if;
  update public.mgr_players
  set wage = round(public.mgr_nominal(ovr, age) * 0.005), contract_until = contract_until + p_seasons
  where id = p_player;
  return 'accepted';
end;
$$;

-- The club breaks a contract: it pays two thirds of the wages for the rounds left, and the player
-- goes to the pool of the league. The squad keeps 17. Returns the penalty.
create or replace function public.mgr_terminate_contract(p_user uuid, p_player uuid)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_club    record;
  v_player  record;
  v_size    integer;
  v_penalty bigint;
begin
  select id, league_id, budget into v_club from public.mgr_clubs where user_id = p_user for update;
  if not found then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  select * into v_player from public.mgr_players where id = p_player and club_id = v_club.id for update;
  if not found or exists (select 1 from public.mgr_auctions where player_id = p_player and status = 'open') then
    raise exception 'manager.player_unavailable' using errcode = 'P0001';
  end if;
  select count(*) into v_size from public.mgr_players where club_id = v_club.id;
  if v_size <= 17 then
    raise exception 'manager.squad_min' using errcode = 'P0001';
  end if;
  v_penalty := round(public.mgr_contract_rounds(p_player) * v_player.wage * 2 / 3.0);
  if v_club.budget < 0 or v_club.budget < v_penalty then
    raise exception 'manager.no_money' using errcode = 'P0001';
  end if;

  update public.mgr_players set club_id = null, pool_league_id = v_club.league_id, training_focus = null where id = p_player;
  update public.mgr_trades set status = 'cancelled', resolved_at = now()
  where status = 'pending' and p_player = any (give_ids || take_ids);
  perform public.mgr_pay(v_club.id, -v_penalty, 'penalty', p_player);
  return v_penalty;
end;
$$;

-- After the season (and in every later preseason): the players whose contract is over leave their
-- clubs for the pool of the league. A bot renews everybody for 2 seasons. A real club never drops
-- below 17 this way: the weakest leave first, and those who would take it below 17 stay one more
-- season. Returns how many left. Safe to call again.
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
  for v_club in select id, user_id from public.mgr_clubs where league_id = p_league loop
    select count(*) into v_size from public.mgr_players where club_id = v_club.id;
    for v_player in
      select id from public.mgr_players
      where club_id = v_club.id and contract_until < v_start
      order by public.mgr_nominal(ovr, age), id
    loop
      if v_club.user_id is null then
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

-- ---- who may call what -------------------------------------------------------------------------

revoke execute on function public.mgr_list_player(uuid, uuid, bigint, smallint) from public, anon, authenticated;
revoke execute on function public.mgr_cancel_auction(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mgr_place_bid(uuid, uuid, bigint) from public, anon, authenticated;
revoke execute on function public.mgr_due_auctions() from public, anon, authenticated;
revoke execute on function public.mgr_settle_auction(uuid) from public, anon, authenticated;
revoke execute on function public.mgr_propose_trade(uuid, uuid, uuid[], uuid[], bigint) from public, anon, authenticated;
revoke execute on function public.mgr_accept_trade(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mgr_close_trade(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.mgr_expire_trades() from public, anon, authenticated;
revoke execute on function public.mgr_buy_free_agent(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mgr_list_player(uuid, uuid, bigint, smallint) to service_role;
grant execute on function public.mgr_cancel_auction(uuid, uuid) to service_role;
grant execute on function public.mgr_place_bid(uuid, uuid, bigint) to service_role;
grant execute on function public.mgr_due_auctions() to service_role;
grant execute on function public.mgr_settle_auction(uuid) to service_role;
grant execute on function public.mgr_propose_trade(uuid, uuid, uuid[], uuid[], bigint) to service_role;
grant execute on function public.mgr_accept_trade(uuid, uuid) to service_role;
grant execute on function public.mgr_close_trade(uuid, uuid, text) to service_role;
grant execute on function public.mgr_expire_trades() to service_role;
grant execute on function public.mgr_buy_free_agent(uuid, uuid) to service_role;
revoke execute on function public.mgr_extend_contract(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.mgr_terminate_contract(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mgr_release_expired(uuid) from public, anon, authenticated;
revoke execute on function public.mgr_player_defaults() from public, anon, authenticated;
revoke execute on function public.mgr_club_joined() from public, anon, authenticated;
grant execute on function public.mgr_extend_contract(uuid, uuid, integer) to service_role;
grant execute on function public.mgr_terminate_contract(uuid, uuid) to service_role;
grant execute on function public.mgr_release_expired(uuid) to service_role;
