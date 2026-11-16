-- Admin console and the moderator role (DAZBY-152, D-139, docs/ADMIN.md).
-- Backward compatible: a wider list of roles and of ledger reasons, new columns with defaults,
-- new tables and functions; mgr_market_open only gets one more condition (the freeze flag).
--
-- Every change made from the console goes through the functions below (security definer, only the
-- server with the service key may call them). Each one checks the role of the ACTOR in the
-- database again (the server checks it first), demands a reason and writes the audit row in the
-- same transaction as the change, so a change without a record cannot happen.

-- ---- the moderator role --------------------------------------------------------------------------

do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%';
  if c is not null then execute format('alter table public.profiles drop constraint %I', c); end if;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'moderator', 'admin'));

-- Admin or moderator (the staff of the site). is_admin() stays "admin only".
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role in ('moderator', 'admin')
  );
$$;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

-- The rank of a role: user 0, moderator 1, admin 2.
create or replace function public.adm_rank(p_role text)
returns integer language sql immutable set search_path = '' as $$
  select case p_role when 'admin' then 2 when 'moderator' then 1 else 0 end;
$$;

-- The staff role of an actor, or null when he is neither a moderator nor an admin.
create or replace function public.adm_role(p_actor uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = p_actor and role in ('moderator', 'admin');
$$;

-- ---- the audit log -------------------------------------------------------------------------------

create table public.admin_audit (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id   uuid references public.profiles (id) on delete set null,
  actor_role text not null,
  action     text not null check (char_length(action) between 1 and 60),
  entity     text not null check (char_length(entity) between 1 and 60),
  entity_id  text,
  -- Only the fields that changed: what was and what became.
  before     jsonb,
  after      jsonb,
  reason     text,
  meta       jsonb
);
create index admin_audit_created_idx on public.admin_audit (created_at desc, id desc);
create index admin_audit_entity_idx on public.admin_audit (entity, entity_id);
create index admin_audit_actor_idx on public.admin_audit (actor_id);
comment on table public.admin_audit is 'Who changed what from the admin console: the fields before and after, and the reason.';

alter table public.admin_audit enable row level security;
create policy admin_audit_select on public.admin_audit for select to authenticated using (public.is_staff());
revoke all on public.admin_audit from anon, authenticated;
grant select on public.admin_audit to authenticated;

-- Writes one audit row. Inside other functions and for the server (actions that are not in the database).
create or replace function public.adm_log(
  p_actor uuid, p_action text, p_entity text, p_entity_id text,
  p_before jsonb, p_after jsonb, p_reason text, p_meta jsonb default null
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text;
  v_id bigint;
begin
  v_role := public.adm_role(p_actor);
  if v_role is null then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.admin_audit (actor_id, actor_role, action, entity, entity_id, before, after, reason, meta)
  values (p_actor, v_role, p_action, p_entity, p_entity_id, p_before, p_after, p_reason, p_meta)
  returning id into v_id;
  return v_id;
end;
$$;

-- The reason is mandatory for every change.
create or replace function public.adm_need_reason(p_reason text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'a reason of at least 5 characters is required' using errcode = '22023';
  end if;
end;
$$;

-- The role of the actor must be at least p_min; returns the role.
create or replace function public.adm_require(p_actor uuid, p_min text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_role text;
begin
  v_role := public.adm_role(p_actor);
  if v_role is null or public.adm_rank(v_role) < public.adm_rank(p_min) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_role;
end;
$$;

-- ---- who can edit which field --------------------------------------------------------------------

create table public.admin_entities (
  entity     text primary key,
  table_name text not null
);
create table public.admin_edit_rules (
  entity      text not null references public.admin_entities (entity) on delete cascade,
  column_name text not null,
  min_role    text not null check (min_role in ('moderator', 'admin')),
  primary key (entity, column_name)
);
alter table public.admin_entities enable row level security;
alter table public.admin_edit_rules enable row level security;
revoke all on public.admin_entities, public.admin_edit_rules from anon, authenticated;

insert into public.admin_entities (entity, table_name) values
  ('profiles', 'profiles'), ('clubs', 'mgr_clubs'), ('players', 'mgr_players');

-- Money, the squad's numbers and the structure of leagues are never edited by hand here: money goes
-- through adm_adjust_budget, the rest is the game's own. A moderator only handles names and pictures.
insert into public.admin_edit_rules (entity, column_name, min_role) values
  ('profiles', 'nickname', 'moderator'),
  ('profiles', 'full_name', 'moderator'),
  ('profiles', 'contact', 'moderator'),
  ('profiles', 'about', 'moderator'),
  ('profiles', 'avatar_path', 'moderator'),
  ('profiles', 'country_code', 'admin'),
  ('profiles', 'city', 'admin'),
  ('profiles', 'utc_offset_minutes', 'admin'),
  ('clubs', 'name', 'moderator'),
  ('clubs', 'logo_path', 'moderator'),
  ('clubs', 'primary_color', 'admin'),
  ('clubs', 'secondary_color', 'admin'),
  ('players', 'first_name', 'moderator'),
  ('players', 'last_name', 'moderator'),
  ('players', 'age', 'admin'),
  ('players', 'form', 'admin'),
  ('players', 'fitness', 'admin'),
  ('players', 'morale', 'admin');

-- Changes fields of one row (uuid key) of an entity, checking the role per field.
-- Returns { before, after } with the changed fields only.
create or replace function public.adm_edit(p_actor uuid, p_entity text, p_id uuid, p_patch jsonb, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_role text;
  v_table text;
  v_key text;
  v_min text;
  v_cols text[] := '{}';
  v_list text;
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
begin
  v_role := public.adm_require(p_actor, 'moderator');
  perform public.adm_need_reason(p_reason);
  select table_name into v_table from public.admin_entities where entity = p_entity;
  if v_table is null then raise exception 'unknown entity %', p_entity using errcode = '22023'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be an object' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    select min_role into v_min from public.admin_edit_rules where entity = p_entity and column_name = v_key;
    if v_min is null then raise exception 'field % is not editable', v_key using errcode = '22023'; end if;
    if public.adm_rank(v_role) < public.adm_rank(v_min) then
      raise exception 'forbidden: field % needs the % role', v_key, v_min using errcode = '42501';
    end if;
    v_cols := v_cols || format('%I', v_key);
  end loop;
  if cardinality(v_cols) = 0 then raise exception 'nothing to change' using errcode = '22023'; end if;
  v_list := array_to_string(v_cols, ', ');

  execute format('select to_jsonb(t) from public.%I t where id = $1 for update', v_table) into v_row using p_id;
  if v_row is null then raise exception 'not found' using errcode = 'P0002'; end if;

  execute format(
    'update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I, $2)) where t.id = $1',
    v_table, v_list, v_list, v_table
  ) using p_id, p_patch;

  execute format('select to_jsonb(t) from public.%I t where id = $1', v_table) into v_after using p_id;
  select coalesce(jsonb_object_agg(k, v_row -> k), '{}'::jsonb) into v_before
    from jsonb_object_keys(p_patch) k;
  select coalesce(jsonb_object_agg(k, v_after -> k), '{}'::jsonb) into v_after
    from jsonb_object_keys(p_patch) k;

  perform public.adm_log(p_actor, 'edit', p_entity, p_id::text, v_before, v_after, p_reason);
  return jsonb_build_object('before', v_before, 'after', v_after);
end;
$$;

-- ---- the role of a user (admin only) -------------------------------------------------------------

-- Replaces the role of the first migration: it also knows "moderator" and writes the audit row.
create or replace function public.set_user_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new_role not in ('user', 'moderator', 'admin') then
    raise exception 'invalid role';
  end if;
  select role into v_old from public.profiles where id = target;
  if new_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1
     and v_old = 'admin' then
    raise exception 'cannot demote the last admin';
  end if;
  update public.profiles set role = new_role where id = target;
  insert into public.admin_audit (actor_id, actor_role, action, entity, entity_id, before, after, reason)
  values ((select auth.uid()), 'admin', 'set_role', 'profiles', target::text,
          jsonb_build_object('role', v_old), jsonb_build_object('role', new_role), null);
end $$;

-- The same for the console: with a reason, called with the service key for a checked actor.
create or replace function public.adm_set_role(p_actor uuid, p_target uuid, p_role text, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_old text;
begin
  perform public.adm_require(p_actor, 'admin');
  perform public.adm_need_reason(p_reason);
  if p_role not in ('user', 'moderator', 'admin') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  select role into v_old from public.profiles where id = p_target for update;
  if v_old is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_role <> 'admin' and v_old = 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'cannot demote the last admin';
  end if;
  update public.profiles set role = p_role where id = p_target;
  perform public.adm_log(p_actor, 'set_role', 'profiles', p_target::text,
    jsonb_build_object('role', v_old), jsonb_build_object('role', p_role), p_reason);
  return jsonb_build_object('before', jsonb_build_object('role', v_old), 'after', jsonb_build_object('role', p_role));
end;
$$;

-- ---- club actions ----------------------------------------------------------------------------------

-- Freezing the market of a club: it can neither put a lot up nor bid nor trade nor buy a free player.
alter table public.mgr_clubs add column market_frozen boolean not null default false;
alter table public.mgr_clubs add column market_frozen_reason text;
comment on column public.mgr_clubs.market_frozen is 'Set from the admin console: mgr_market_open is false for the club, so every market function refuses it.';

create or replace function public.mgr_market_open(p_club uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.mgr_clubs where id = p_club and league_id is not null and not market_frozen)
    and (select count(*) from public.mgr_matches
         where kind = 'league' and status = 'finished' and p_club in (home_club_id, away_club_id)) >= 10;
$$;

create or replace function public.adm_set_frozen(p_actor uuid, p_club uuid, p_frozen boolean, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_old boolean;
begin
  perform public.adm_require(p_actor, 'moderator');
  perform public.adm_need_reason(p_reason);
  select market_frozen into v_old from public.mgr_clubs where id = p_club for update;
  if v_old is null then raise exception 'not found' using errcode = 'P0002'; end if;
  update public.mgr_clubs
    set market_frozen = p_frozen, market_frozen_reason = case when p_frozen then btrim(p_reason) else null end
    where id = p_club;
  perform public.adm_log(p_actor, case when p_frozen then 'freeze_market' else 'unfreeze_market' end, 'clubs', p_club::text,
    jsonb_build_object('market_frozen', v_old), jsonb_build_object('market_frozen', p_frozen), p_reason);
  return jsonb_build_object('before', jsonb_build_object('market_frozen', v_old), 'after', jsonb_build_object('market_frozen', p_frozen));
end;
$$;

-- A new ledger reason for a correction made by an admin.
do $$
declare
  c text;
  def text;
begin
  select conname, pg_get_constraintdef(oid) into c, def from pg_constraint
  where conrelid = 'public.mgr_transactions'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%reason%';
  if c is null then raise exception 'ledger reason check not found'; end if;
  if def not like '%''admin''%' then
    execute format('alter table public.mgr_transactions drop constraint %I', c);
    -- Append the value to the list of the current definition, whatever other values it holds.
    execute format('alter table public.mgr_transactions add constraint %I %s', c,
      regexp_replace(def, '\]', ', ''admin''::text]'));
  end if;
end $$;

-- Changes the budget of a club through the ledger (a correction with a reason), never by a direct update.
create or replace function public.adm_adjust_budget(p_actor uuid, p_club uuid, p_amount bigint, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_old bigint;
  v_new bigint;
begin
  perform public.adm_require(p_actor, 'admin');
  perform public.adm_need_reason(p_reason);
  if p_amount is null or p_amount = 0 then raise exception 'amount must not be zero' using errcode = '22023'; end if;
  select budget into v_old from public.mgr_clubs where id = p_club for update;
  if v_old is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_old + p_amount < 0 then raise exception 'the budget cannot become negative' using errcode = '22023'; end if;
  v_new := public.mgr_pay(p_club, p_amount, 'admin', null);
  perform public.adm_log(p_actor, 'adjust_budget', 'clubs', p_club::text,
    jsonb_build_object('budget', v_old), jsonb_build_object('budget', v_new), p_reason,
    jsonb_build_object('amount', p_amount));
  return jsonb_build_object('before', jsonb_build_object('budget', v_old), 'after', jsonb_build_object('budget', v_new));
end;
$$;

-- A club of a user becomes a bot (the user stays; he can make a new club).
create or replace function public.adm_make_bot(p_actor uuid, p_club uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid; v_bot boolean;
begin
  perform public.adm_require(p_actor, 'admin');
  perform public.adm_need_reason(p_reason);
  select user_id, is_bot into v_user, v_bot from public.mgr_clubs where id = p_club for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_bot then raise exception 'the club is already a bot' using errcode = '22023'; end if;
  update public.mgr_clubs set user_id = null, is_bot = true where id = p_club;
  perform public.adm_log(p_actor, 'make_bot', 'clubs', p_club::text,
    jsonb_build_object('user_id', v_user, 'is_bot', false), jsonb_build_object('user_id', null, 'is_bot', true), p_reason);
  return jsonb_build_object('before', jsonb_build_object('user_id', v_user), 'after', jsonb_build_object('user_id', null));
end;
$$;

-- Brings a club back from deactivation. The "dormant" flag comes with DAZBY-151; until its migration
-- is applied the function says so instead of failing in a strange way.
create or replace function public.adm_reactivate_club(p_actor uuid, p_club uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_old boolean;
begin
  perform public.adm_require(p_actor, 'admin');
  perform public.adm_need_reason(p_reason);
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mgr_clubs' and column_name = 'dormant'
  ) then
    raise exception 'dormant clubs are not available yet' using errcode = '0A000';
  end if;
  execute 'select dormant from public.mgr_clubs where id = $1 for update' into v_old using p_club;
  if v_old is null then raise exception 'not found' using errcode = 'P0002'; end if;
  execute 'update public.mgr_clubs set dormant = false where id = $1' using p_club;
  perform public.adm_log(p_actor, 'reactivate_club', 'clubs', p_club::text,
    jsonb_build_object('dormant', v_old), jsonb_build_object('dormant', false), p_reason);
  return jsonb_build_object('before', jsonb_build_object('dormant', v_old), 'after', jsonb_build_object('dormant', false));
end;
$$;

-- ---- suspicious activity (D-137: soft signals from the game's own data, no IP, no fingerprints) -----

create table public.admin_reviews (
  kind        text not null,
  subject     text not null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz not null default now(),
  note        text,
  primary key (kind, subject)
);
alter table public.admin_reviews enable row level security;
create policy admin_reviews_select on public.admin_reviews for select to authenticated using (public.is_staff());
revoke all on public.admin_reviews from anon, authenticated;
grant select on public.admin_reviews to authenticated;

-- The signals. One row = one finding about one pair (or group) of clubs, with the numbers behind it.
-- subject is stable (sorted ids), so "reviewed" survives a refresh. Nothing here bans anybody.
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
    where status = 'sold' and buyer_club_id is not null and final_price * 9 >= nominal * 20
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
    from public.mgr_auctions where status = 'sold' and buyer_club_id is not null
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

create or replace function public.adm_mark_reviewed(p_actor uuid, p_kind text, p_subject text, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.adm_require(p_actor, 'moderator');
  insert into public.admin_reviews (kind, subject, reviewed_by, note)
  values (p_kind, p_subject, p_actor, nullif(btrim(p_note), ''))
  on conflict (kind, subject) do update set reviewed_by = excluded.reviewed_by, reviewed_at = now(), note = excluded.note;
  perform public.adm_log(p_actor, 'mark_reviewed', 'suspicious', p_kind || ':' || p_subject, null, null, p_note);
end;
$$;

-- ---- grants: the server (service role) only --------------------------------------------------------

revoke execute on function public.adm_rank(text) from public, anon, authenticated;
revoke execute on function public.adm_role(uuid) from public, anon, authenticated;
revoke execute on function public.adm_log(uuid, text, text, text, jsonb, jsonb, text, jsonb) from public, anon, authenticated;
revoke execute on function public.adm_need_reason(text) from public, anon, authenticated;
revoke execute on function public.adm_require(uuid, text) from public, anon, authenticated;
revoke execute on function public.adm_edit(uuid, text, uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.adm_set_role(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.adm_set_frozen(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.adm_adjust_budget(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke execute on function public.adm_make_bot(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.adm_reactivate_club(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.adm_suspicious() from public, anon, authenticated;
revoke execute on function public.adm_mark_reviewed(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.adm_rank(text) to service_role;
grant execute on function public.adm_role(uuid) to service_role;
grant execute on function public.adm_log(uuid, text, text, text, jsonb, jsonb, text, jsonb) to service_role;
grant execute on function public.adm_edit(uuid, text, uuid, jsonb, text) to service_role;
grant execute on function public.adm_set_role(uuid, uuid, text, text) to service_role;
grant execute on function public.adm_set_frozen(uuid, uuid, boolean, text) to service_role;
grant execute on function public.adm_adjust_budget(uuid, uuid, bigint, text) to service_role;
grant execute on function public.adm_make_bot(uuid, uuid, text) to service_role;
grant execute on function public.adm_reactivate_club(uuid, uuid, text) to service_role;
grant execute on function public.adm_suspicious() to service_role;
grant execute on function public.adm_mark_reviewed(uuid, text, text, text) to service_role;
