-- Football manager reliability, part 2 (DAZBY-151, D-138): the round is calculated under a lease, a
-- league's matches are calculated a few minutes after kickoff (each league has its own stable delay),
-- a cheap "is there anything to do" check, and a signal of a stuck scheduler.
-- Backward compatible: new tables, one generated column and new functions; nothing is changed.
--
-- The result of a match never depends on the delay: it is decided by the match and the lineups, which
-- are locked from 5 minutes before kickoff. The delay only spreads the load after 10:00.

-- ---- lease: one runner of the rounds at a time -------------------------------------------------

create table public.mgr_leases (
  name   text primary key,
  holder text not null,
  until  timestamptz not null
);
alter table public.mgr_leases enable row level security;
revoke all on public.mgr_leases from anon, authenticated;

-- Takes the lease for p_seconds, or renews it for the same holder; false when someone else holds it
-- and it has not run out yet (a runner that died frees it by itself).
create or replace function public.mgr_try_lease(p_name text, p_holder text, p_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.mgr_leases as l (name, holder, until)
  values (p_name, p_holder, now() + make_interval(secs => p_seconds))
  on conflict (name) do update
    set holder = excluded.holder, until = excluded.until
    where l.until <= now() or l.holder = excluded.holder;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.mgr_release_lease(p_name text, p_holder text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.mgr_leases where name = p_name and holder = p_holder;
$$;

-- ---- the delay of a league ---------------------------------------------------------------------

-- 0 to 719 seconds (under 12 minutes), the same for a league for ever, spread by its id.
alter table public.mgr_leagues
  add column play_delay_seconds integer generated always as (abs(hashtext(id::text)::bigint) % 720) stored;
comment on column public.mgr_leagues.play_delay_seconds is
  'The matches of the league are calculated this many seconds after their kickoff (spreads the load; the result does not depend on it).';

-- The matches that are due, oldest first: kickoff plus the delay of the league has passed.
create or replace function public.mgr_due_matches(p_now timestamptz, p_limit integer)
returns table (id uuid, kickoff_at timestamptz, kind text, home_club_id uuid, away_club_id uuid)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.kickoff_at, m.kind, m.home_club_id, m.away_club_id
  from public.mgr_matches m
  join public.mgr_leagues l on l.id = m.league_id
  where m.status = 'scheduled'
    and m.kickoff_at <= p_now
    and m.kickoff_at + make_interval(secs => l.play_delay_seconds) <= p_now
  order by m.kickoff_at + make_interval(secs => l.play_delay_seconds), m.id
  limit greatest(p_limit, 0);
$$;

-- Is there anything for the scheduler to do? One cheap query instead of the whole run: a match due,
-- a league to close or open, a preseason day, a new month for the pool, a lot or an offer out of time.
create or replace function public.mgr_work_due(p_now timestamptz default now())
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
      select 1 from public.mgr_matches m join public.mgr_leagues l on l.id = m.league_id
      where m.status = 'scheduled' and m.kickoff_at <= p_now
        and m.kickoff_at + make_interval(secs => l.play_delay_seconds) <= p_now
    )
    or exists (select 1 from public.mgr_leagues_to_close())
    or exists (select 1 from public.mgr_leagues_to_open())
    or exists (
      select 1 from public.mgr_leagues l
      where l.phase = 'preseason' and l.last_tick_at is not null and l.preseason_ends_at is not null
        and l.last_tick_at + interval '1 day' <= p_now
        and l.last_tick_at + interval '1 day' < l.preseason_ends_at
    )
    or exists (
      select 1 from public.mgr_leagues l
      where l.pool_month is distinct from to_char(p_now at time zone 'utc', 'YYYY-MM')
    )
    or exists (select 1 from public.mgr_auctions where status = 'open' and ends_at <= p_now)
    or exists (select 1 from public.mgr_trades where status = 'pending' and expires_at <= p_now);
$$;

-- How many matches (and lots) have been waiting for longer than p_minutes after their time: more than
-- zero means the scheduler and the visits are not playing the rounds.
create or replace function public.mgr_overdue_count(p_minutes integer)
returns integer
language sql stable security definer set search_path = ''
as $$
  select (
    select count(*)
    from public.mgr_matches m join public.mgr_leagues l on l.id = m.league_id
    where m.status = 'scheduled'
      and m.kickoff_at + make_interval(secs => l.play_delay_seconds, mins => p_minutes) <= now()
  )::integer + (
    select count(*) from public.mgr_auctions
    where status = 'open' and ends_at + make_interval(mins => p_minutes) <= now()
  )::integer;
$$;

-- ---- alerts: tell the owner once, not on every check ------------------------------------------

create table public.mgr_alerts (
  name        text primary key,
  state       text not null,
  notified_at timestamptz not null default now()
);
alter table public.mgr_alerts enable row level security;
revoke all on public.mgr_alerts from anon, authenticated;

-- Records the state of a monitored thing. Returns true when the change has to be announced: the state
-- differs from the last announced one and at least p_min_seconds have passed since that announcement
-- (a change that comes too soon is not recorded, so a later check announces it). The first state ever
-- seen is announced only when it is not 'ok'.
create or replace function public.mgr_alert_change(p_name text, p_state text, p_min_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.mgr_alerts;
begin
  insert into public.mgr_alerts (name, state, notified_at)
  values (p_name, p_state, case when p_state = 'ok' then 'epoch'::timestamptz else now() end)
  on conflict (name) do nothing;
  if found then
    return p_state <> 'ok';
  end if;
  select * into v_row from public.mgr_alerts where name = p_name for update;
  if v_row.state = p_state then
    return false;
  end if;
  if v_row.notified_at + make_interval(secs => p_min_seconds) > now() then
    return false;
  end if;
  update public.mgr_alerts set state = p_state, notified_at = now() where name = p_name;
  return true;
end;
$$;

revoke execute on function public.mgr_try_lease(text, text, integer) from public, anon, authenticated;
revoke execute on function public.mgr_release_lease(text, text) from public, anon, authenticated;
revoke execute on function public.mgr_due_matches(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.mgr_work_due(timestamptz) from public, anon, authenticated;
revoke execute on function public.mgr_overdue_count(integer) from public, anon, authenticated;
revoke execute on function public.mgr_alert_change(text, text, integer) from public, anon, authenticated;
grant execute on function public.mgr_try_lease(text, text, integer) to service_role;
grant execute on function public.mgr_release_lease(text, text) to service_role;
grant execute on function public.mgr_due_matches(timestamptz, integer) to service_role;
grant execute on function public.mgr_work_due(timestamptz) to service_role;
grant execute on function public.mgr_overdue_count(integer) to service_role;
grant execute on function public.mgr_alert_change(text, text, integer) to service_role;
