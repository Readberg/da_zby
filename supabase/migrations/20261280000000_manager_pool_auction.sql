-- DAZBY-166 (D-146): the free players of the monthly pool are bought through bids, not at once.
-- Every pool player gets a lot without a seller (seller_club_id is null): the start price is his nominal
-- value, the clubs of the league bid, the lot is settled at the daily tick with the others. The money of
-- the winner leaves the game (no seller, no tax). A pool player nobody bid on stays in the pool and is put
-- up again for the next tick; the unsold ones go at the start of the next month, as before.
-- Backward compatible: a column becomes nullable, functions are replaced, nothing is dropped.

alter table public.mgr_auctions alter column seller_club_id drop not null;
comment on column public.mgr_auctions.seller_club_id is 'The club that put the player up; null for a lot of the monthly pool (no seller, the money leaves the game).';

-- ---- the lots of the pool ------------------------------------------------------------------------

-- Puts every pool player who has no open lot up (all leagues, or one). Idempotent: a player has at most one
-- open lot (the unique index), a second call does nothing. The tick is the first 10:00 Moscow time at least
-- 12 hours from now. Returns how many lots were made.
create or replace function public.mgr_list_pool(p_league uuid default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_tick timestamptz;
  v_n    integer;
begin
  v_tick := (date_trunc('day', (now() + interval '12 hours') at time zone 'utc') + interval '7 hours') at time zone 'utc';
  if v_tick < now() + interval '12 hours' then
    v_tick := v_tick + interval '1 day';
  end if;
  with made as (
    insert into public.mgr_auctions (league_id, player_id, seller_club_id, start_price, step_percent, nominal, ends_at)
    select p.pool_league_id, p.id, null, public.mgr_nominal(p.ovr, p.age), 10, public.mgr_nominal(p.ovr, p.age), v_tick
    from public.mgr_players p
    where p.club_id is null and p.pool_league_id is not null
      and (p_league is null or p.pool_league_id = p_league)
      and not exists (select 1 from public.mgr_auctions a where a.player_id = p.id and a.status = 'open')
    on conflict (player_id) where status = 'open' do nothing
    returning 1
  )
  select count(*) into v_n from made;
  return v_n;
end;
$$;

-- The monthly pool: as before, plus a lot for each new player.
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
  perform public.mgr_list_pool(p_league);
  update public.mgr_leagues set pool_month = p_month where id = p_league;
  return true;
end;
$$;

-- The instant purchase is over: the pool goes by bids. The function stays for old clients.
create or replace function public.mgr_buy_free_agent(p_user uuid, p_player uuid)
returns bigint
language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'manager.pool_by_bids' using errcode = 'P0001';
end;
$$;

-- A bid. As before; a lot without a seller has no pair of clubs to limit.
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
  if v_auction.seller_club_id is not null and public.mgr_deal_done(v_club.id, v_auction.seller_club_id, v_season) then
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

-- Closes one lot whose time is up, once ('sold', 'unsold', 'cancelled'; null: nothing to close).
-- A lot of a club: as before. A lot of the pool: the bids are tried from the highest; a bid is struck
-- out when its club cannot pay, has 23 players or has left the league; the winner pays the whole price
-- (it leaves the game), no deal is recorded. No valid bid: 'unsold', the player stays in the pool.
create or replace function public.mgr_settle_auction(p_auction uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_auction record;
  v_bid     record;
  v_season  smallint;
  v_buyer   record;
  v_size    integer;
  v_tax     bigint;
  v_payout  bigint;
begin
  select * into v_auction from public.mgr_auctions where id = p_auction for update;
  if not found or v_auction.status <> 'open' or v_auction.ends_at > now() then
    return null;
  end if;
  select season into v_season from public.mgr_leagues where id = v_auction.league_id;

  if v_auction.seller_club_id is null then
    -- A pool lot: the player must still be a free player of this league.
    if not exists (
      select 1 from public.mgr_players
      where id = v_auction.player_id and club_id is null and pool_league_id = v_auction.league_id
    ) then
      update public.mgr_auctions set status = 'cancelled', closed_at = now() where id = p_auction;
      return 'cancelled';
    end if;
    for v_bid in
      select b.id, b.club_id, b.amount from public.mgr_bids b
      where b.auction_id = p_auction and b.status = 'active'
      order by b.amount desc, b.id
    loop
      select budget into v_buyer from public.mgr_clubs
      where id = v_bid.club_id and league_id = v_auction.league_id for update;
      if not found then
        update public.mgr_bids set status = 'struck' where auction_id = p_auction and club_id = v_bid.club_id and status = 'active';
        continue;
      end if;
      select count(*) into v_size from public.mgr_players where club_id = v_bid.club_id;
      if v_buyer.budget < 0 or v_buyer.budget < v_bid.amount or v_size >= 23 then
        update public.mgr_bids set status = 'struck' where auction_id = p_auction and club_id = v_bid.club_id and status = 'active';
        continue;
      end if;
      perform public.mgr_hand_over(v_auction.player_id, v_bid.club_id);
      perform public.mgr_pay(v_bid.club_id, -v_bid.amount, 'purchase', v_auction.player_id);
      update public.mgr_bids set status = 'won' where id = v_bid.id;
      update public.mgr_bids set status = 'lost' where auction_id = p_auction and status = 'active' and id <> v_bid.id;
      update public.mgr_auctions
      set status = 'sold', buyer_club_id = v_bid.club_id, final_price = v_bid.amount, closed_at = now()
      where id = p_auction;
      return 'sold';
    end loop;
    update public.mgr_auctions set status = 'unsold', closed_at = now() where id = p_auction;
    return 'unsold';
  end if;

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

revoke execute on function public.mgr_list_pool(uuid) from public, anon, authenticated;
grant execute on function public.mgr_list_pool(uuid) to service_role;

-- Lots for the players who are in the pool now (the pool of this month was made before this change).
select public.mgr_list_pool();

-- ---- the anti-fraud signals: a lot without a seller is not a pair of clubs -----------------------
-- The same function as in 20261210000000_admin_console.sql, with three filters on seller_club_id.

create or replace function public.adm_suspicious()
returns table (kind text, subject text, club_ids uuid[], score integer, details jsonb, reviewed_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with
  deal_pairs as (
    select club_a, club_b, count(*) as deals, min(created_at) as first_at, max(created_at) as last_at
    from public.mgr_deals group by club_a, club_b
  ),
  -- a club's number of different partners
  partners as (
    select club, count(distinct other) as n from (
      select club_a as club, club_b as other from public.mgr_deals
      union all select club_b, club_a from public.mgr_deals
    ) x group by club
  ),
  -- 1. the same two clubs deal in several seasons
  repeat_pair as (
    select 'repeat_pair'::text as kind, club_a::text || '|' || club_b::text as subject,
           array[club_a, club_b] as club_ids, (deals * 20)::integer as score,
           jsonb_build_object('deals', deals, 'first', first_at, 'last', last_at) as details
    from deal_pairs where deals >= 2
  ),
  -- 2. a seller sells for more than the market can pay out: the buyer overpays, the seller's payout is capped
  cap_sales as (
    select seller_club_id as a, buyer_club_id as b, count(*) as lots, sum(final_price) as sum_price,
           round(avg(final_price::numeric / nominal), 2) as avg_ratio
    from public.mgr_auctions
    where status = 'sold' and buyer_club_id is not null and seller_club_id is not null and final_price * 9 >= nominal * 20
    group by seller_club_id, buyer_club_id
  ),
  cap_price as (
    select 'cap_price'::text, least(a, b)::text || '|' || greatest(a, b)::text,
           array[a, b], least(100, (lots * 35)::integer),
           jsonb_build_object('seller', a, 'buyer', b, 'lots', lots, 'sum_price', sum_price, 'avg_ratio', avg_ratio)
    from cap_sales
  ),
  -- 3. a seller whose lots almost all go to one buyer
  seller_buyers as (
    select seller_club_id as seller, buyer_club_id as buyer, count(*) as n,
           sum(count(*)) over (partition by seller_club_id) as total
    from public.mgr_auctions where status = 'sold' and buyer_club_id is not null and seller_club_id is not null
    group by seller_club_id, buyer_club_id
  ),
  one_buyer as (
    select 'one_buyer'::text, least(seller, buyer)::text || '|' || greatest(seller, buyer)::text,
           array[seller, buyer], least(100, (n * 25)::integer),
           jsonb_build_object('seller', seller, 'buyer', buyer, 'lots_to_buyer', n, 'lots_total', total)
    from seller_buyers where total >= 3 and n::numeric / total >= 0.8
  ),
  -- 4. two accounts made within two hours that deal only with each other
  new_pair as (
    select 'new_pair'::text, p.club_a::text || '|' || p.club_b::text,
           array[p.club_a, p.club_b], 60,
           jsonb_build_object('created_a', pa.created_at, 'created_b', pb.created_at,
                              'minutes_apart', round(abs(extract(epoch from (pa.created_at - pb.created_at))) / 60))
    from deal_pairs p
    join public.mgr_clubs ca on ca.id = p.club_a
    join public.mgr_clubs cb on cb.id = p.club_b
    join public.profiles pa on pa.id = ca.user_id
    join public.profiles pb on pb.id = cb.user_id
    join partners na on na.club = p.club_a and na.n = 1
    join partners nb on nb.club = p.club_b and nb.n = 1
    where abs(extract(epoch from (pa.created_at - pb.created_at))) <= 7200
  ),
  -- 5. accounts that left the same contact, and have dealt with each other
  contacts as (
    select c.id as club, lower(btrim(p.contact)) as contact
    from public.mgr_clubs c join public.profiles p on p.id = c.user_id
    where p.contact is not null and char_length(btrim(p.contact)) >= 3
  ),
  same_contact as (
    select 'same_contact'::text, least(x.club, y.club)::text || '|' || greatest(x.club, y.club)::text,
           array[least(x.club, y.club), greatest(x.club, y.club)],
           case when exists (
             select 1 from public.mgr_deals d
             where d.club_a = least(x.club, y.club) and d.club_b = greatest(x.club, y.club)
           ) then 90 else 40 end,
           jsonb_build_object('contact', x.contact)
    from contacts x join contacts y on x.contact = y.contact and x.club < y.club
  ),
  -- 6. a club that bids only on the lots of one seller (at least 3 bids)
  bid_sellers as (
    select b.club_id as bidder, a.seller_club_id as seller, count(*) as n,
           sum(count(*)) over (partition by b.club_id) as total
    from public.mgr_bids b join public.mgr_auctions a on a.id = b.auction_id
    where a.seller_club_id is not null
    group by b.club_id, a.seller_club_id
  ),
  bids_one_seller as (
    select 'bids_one_seller'::text, least(bidder, seller)::text || '|' || greatest(bidder, seller)::text,
           array[bidder, seller], least(100, (n * 15)::integer),
           jsonb_build_object('bidder', bidder, 'seller', seller, 'bids_on_seller', n, 'bids_total', total)
    from bid_sellers where total >= 3 and n = total
  ),
  everything as (
    select * from repeat_pair union all select * from cap_price union all select * from one_buyer
    union all select * from new_pair union all select * from same_contact union all select * from bids_one_seller
  )
  select e.kind, e.subject, e.club_ids, e.score, e.details, r.reviewed_at
  from everything e
  left join public.admin_reviews r on r.kind = e.kind and r.subject = e.subject
  order by (r.reviewed_at is not null), e.score desc, e.kind, e.subject;
$$;


revoke execute on function public.adm_suspicious() from public, anon, authenticated;
grant execute on function public.adm_suspicious() to service_role;
