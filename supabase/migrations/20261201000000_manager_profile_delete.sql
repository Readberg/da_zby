-- Football manager reliability, part 1 (DAZBY-151, D-138): deleting a user must not break a league.
-- Until now mgr_clubs.user_id was "on delete cascade": removing a profile removed its club and, through
-- mgr_matches, the club's fixtures, which left a league of 19 clubs that could never open its next season
-- (openReadySeasons needs exactly 20). Now the club of a deleted user becomes a bot of the same league:
-- the fixtures, the results and the points stay, the squad stays (a real club can take the place later,
-- mgr_take_bot_place), the money and the choices of the owner go.
-- Backward compatible: one foreign key changes its action, new functions and a trigger.

-- Cancels everything a club has on the market: its lots (their bids are lost), its bids on the lots of
-- others (the best bid of such a lot is recounted) and the exchange offers it sent or got.
-- Inside other functions only.
create or replace function public.mgr_cancel_club_market(p_club uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_auction uuid;
begin
  -- Its own lots.
  update public.mgr_bids set status = 'lost'
  where status = 'active'
    and auction_id in (select id from public.mgr_auctions where seller_club_id = p_club and status = 'open');
  update public.mgr_auctions set status = 'cancelled', closed_at = now()
  where seller_club_id = p_club and status = 'open';

  -- Its bids on other lots: the lot goes on without them.
  for v_auction in
    select distinct b.auction_id
    from public.mgr_bids b join public.mgr_auctions a on a.id = b.auction_id
    where b.club_id = p_club and b.status = 'active' and a.status = 'open'
  loop
    update public.mgr_bids set status = 'lost'
    where auction_id = v_auction and club_id = p_club and status = 'active';
    update public.mgr_auctions a
    set bid_count = (select count(*) from public.mgr_bids where auction_id = a.id and status = 'active'),
        best_bid = (select max(amount) from public.mgr_bids where auction_id = a.id and status = 'active'),
        best_club_id = (select club_id from public.mgr_bids where auction_id = a.id and status = 'active'
                        order by amount desc, id limit 1)
    where a.id = v_auction;
  end loop;

  update public.mgr_trades set status = 'cancelled', resolved_at = now()
  where status = 'pending' and p_club in (from_club_id, to_club_id);
end;
$$;

-- Turns the club of a user who is gone into a bot of its league (a club that has no league is simply
-- deleted: nobody plays against it). Inside other functions only.
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
  -- Bots keep no purse; the contracts stay (a bot renews them itself, mgr_release_expired).
  update public.mgr_clubs set user_id = null, is_bot = true, budget = 0 where id = p_club;
end;
$$;

create or replace function public.mgr_profile_deleting()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid;
begin
  for v_club in select id from public.mgr_clubs where user_id = old.id loop
    perform public.mgr_make_bot(v_club);
  end loop;
  return old;
end;
$$;

create trigger mgr_profiles_deleting before delete on public.profiles
  for each row execute function public.mgr_profile_deleting();

-- The trigger above has already emptied user_id; the key no longer deletes the club (a safety net).
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.mgr_clubs'::regclass and contype = 'f'
      and confrelid = 'public.profiles'::regclass
  loop
    execute format('alter table public.mgr_clubs drop constraint %I', v_name);
  end loop;
end
$$;
alter table public.mgr_clubs
  add constraint mgr_clubs_user_id_fkey foreign key (user_id) references public.profiles (id) on delete set null;

revoke execute on function public.mgr_cancel_club_market(uuid) from public, anon, authenticated;
revoke execute on function public.mgr_make_bot(uuid) from public, anon, authenticated;
revoke execute on function public.mgr_profile_deleting() from public, anon, authenticated;
