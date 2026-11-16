-- Football manager: statistics of the players (DAZBY-153, D-140).
-- One row per player, season and club, written from the finished league matches in the same
-- transaction that writes the result (a trigger on mgr_matches, so it does not depend on which
-- version of the play function is current). Friendlies do not count.
-- Backward compatible: new tables, functions, a view and a trigger; nothing existing changes.

create table public.mgr_player_stats (
  player_id       uuid not null references public.mgr_players (id) on delete cascade,
  season          smallint not null,
  club_id         uuid not null references public.mgr_clubs (id) on delete cascade,
  league_id       uuid not null references public.mgr_leagues (id) on delete cascade,
  matches         smallint not null default 0,
  goals           smallint not null default 0,
  assists         smallint not null default 0,
  shots           smallint not null default 0,
  shots_on_target smallint not null default 0,
  injuries        smallint not null default 0,
  clean_sheets    smallint not null default 0,
  primary key (player_id, season, club_id)
);
create index mgr_player_stats_league_idx on public.mgr_player_stats (league_id, season);
comment on table public.mgr_player_stats is 'Player statistics per season and club, from finished league matches (mgr_record_player_stats).';
comment on column public.mgr_player_stats.matches is 'Matches in the starting eleven (the engine has no substitutions: a player plays 90 minutes).';
comment on column public.mgr_player_stats.shots is 'Goals + saved shots + missed shots of the player.';
comment on column public.mgr_player_stats.shots_on_target is 'Goals + saved shots.';
comment on column public.mgr_player_stats.clean_sheets is 'Goalkeepers only: matches without a goal conceded.';

-- Which matches are already counted: makes recording (and the backfill) safe to repeat.
create table public.mgr_stats_matches (
  match_id uuid primary key references public.mgr_matches (id) on delete cascade
);

alter table public.mgr_player_stats enable row level security;
alter table public.mgr_stats_matches enable row level security;

-- The statistics of the league of the caller (like its matches and clubs).
create policy mgr_player_stats_select on public.mgr_player_stats for select to authenticated
  using (league_id = (select public.mgr_my_league()));

revoke all on public.mgr_player_stats, public.mgr_stats_matches from anon, authenticated;
grant select on public.mgr_player_stats to authenticated;

-- The career of a player: all seasons together. Reads through the policy of the caller.
create view public.mgr_player_career with (security_invoker = true) as
select player_id,
       count(*)::int as seasons,
       sum(matches)::int as matches,
       sum(goals)::int as goals,
       sum(assists)::int as assists,
       sum(shots)::int as shots,
       sum(shots_on_target)::int as shots_on_target,
       sum(injuries)::int as injuries,
       sum(clean_sheets)::int as clean_sheets
from public.mgr_player_stats
group by player_id;
revoke all on public.mgr_player_career from anon, authenticated;
grant select on public.mgr_player_career to authenticated;

-- The player an event of the chronicle is about: by id when the event has one, otherwise by the
-- surname, and only when exactly one player of the lineup has it (a doubtful event counts for nobody).
create or replace function public.mgr_event_player(p_lineup jsonb, p_id text, p_surname text)
returns uuid
language sql immutable set search_path = ''
as $$
  with l as (
    select (e ->> 'id')::uuid as id, e ->> 'name' as name
    from jsonb_array_elements(case when jsonb_typeof(p_lineup) = 'array' then p_lineup else '[]'::jsonb end) e
  )
  select coalesce(
    (select id from l where p_id is not null and id::text = p_id),
    (
      select (array_agg(id))[1] from l
      where p_id is null and p_surname is not null
        and coalesce(nullif(regexp_replace(name, '^\S+\s*', ''), ''), name) = p_surname
      having count(*) = 1
    )
  );
$$;
revoke execute on function public.mgr_event_player(jsonb, text, text) from public, anon, authenticated;

-- Adds a finished league match to the statistics, once. Returns false when it was already counted
-- (or is not a finished league match).
create or replace function public.mgr_record_player_stats(p_match uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  m record;
begin
  select id, league_id, season, kind, status, home_club_id, away_club_id, home_goals, away_goals,
         events, home_lineup, away_lineup
  into m from public.mgr_matches where id = p_match;
  if not found or m.status <> 'finished' or m.kind <> 'league' then
    return false;
  end if;
  insert into public.mgr_stats_matches (match_id) values (p_match) on conflict do nothing;
  if not found then
    return false;
  end if;

  with lineup as (
    select 'home' as side, m.home_club_id as club, m.away_goals as conceded,
           (e ->> 'id')::uuid as pid, e ->> 'position' as pos
    from jsonb_array_elements(case when jsonb_typeof(m.home_lineup) = 'array' then m.home_lineup else '[]'::jsonb end) e
    union all
    select 'away', m.away_club_id, m.home_goals,
           (e ->> 'id')::uuid, e ->> 'position'
    from jsonb_array_elements(case when jsonb_typeof(m.away_lineup) = 'array' then m.away_lineup else '[]'::jsonb end) e
  ),
  ev as (
    select e ->> 't' as t, e ->> 's' as s, e ->> 'p' as p, e ->> 'a' as a, e ->> 'pid' as pid, e ->> 'aid' as aid
    from jsonb_array_elements(case when jsonb_typeof(m.events) = 'array' then m.events else '[]'::jsonb end) e
    where e ->> 't' in ('goal', 'save', 'miss', 'injury') and e ->> 's' in ('home', 'away')
  ),
  facts as (
    select public.mgr_event_player(case s when 'home' then m.home_lineup else m.away_lineup end, pid, p) as player,
           t, false as is_assist
    from ev
    union all
    select public.mgr_event_player(case s when 'home' then m.home_lineup else m.away_lineup end, aid, a),
           t, true
    from ev where t = 'goal' and (a is not null or aid is not null)
  ),
  per_player as (
    select l.pid, l.club,
           count(*) filter (where f.t = 'goal' and not f.is_assist) as goals,
           count(*) filter (where f.t = 'goal' and f.is_assist) as assists,
           count(*) filter (where f.t in ('goal', 'save', 'miss') and not f.is_assist) as shots,
           count(*) filter (where f.t in ('goal', 'save') and not f.is_assist) as shots_on_target,
           count(*) filter (where f.t = 'injury') as injuries,
           case when l.pos = 'GK' and l.conceded = 0 then 1 else 0 end as clean_sheet
    from lineup l
    left join facts f on f.player = l.pid
    where exists (select 1 from public.mgr_players pl where pl.id = l.pid)
    group by l.pid, l.club, l.pos, l.conceded
  )
  insert into public.mgr_player_stats as s
    (player_id, season, club_id, league_id, matches, goals, assists, shots, shots_on_target, injuries, clean_sheets)
  select pid, m.season, club, m.league_id, 1, goals, assists, shots, shots_on_target, injuries, clean_sheet
  from per_player
  on conflict (player_id, season, club_id) do update set
    matches = s.matches + 1,
    goals = s.goals + excluded.goals,
    assists = s.assists + excluded.assists,
    shots = s.shots + excluded.shots,
    shots_on_target = s.shots_on_target + excluded.shots_on_target,
    injuries = s.injuries + excluded.injuries,
    clean_sheets = s.clean_sheets + excluded.clean_sheets;
  return true;
end;
$$;
revoke execute on function public.mgr_record_player_stats(uuid) from public, anon, authenticated;
grant execute on function public.mgr_record_player_stats(uuid) to service_role;

-- The same transaction as the result: whoever finishes a match also counts it. A failure in the
-- statistics must never stop the league, so it is only a warning (the backfill picks it up later).
create or replace function public.mgr_stats_after_match()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  begin
    perform public.mgr_record_player_stats(new.id);
  exception when others then
    raise warning 'mgr_record_player_stats failed for match %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;
revoke execute on function public.mgr_stats_after_match() from public, anon, authenticated;

create trigger mgr_matches_player_stats
  after update of status on public.mgr_matches
  for each row
  when (old.status = 'scheduled' and new.status = 'finished')
  execute function public.mgr_stats_after_match();

-- Counts every finished league match that is not counted yet (the history before this migration,
-- or a match whose recording failed). Safe to run any number of times; returns how many it counted.
create or replace function public.mgr_backfill_player_stats()
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
      and not exists (select 1 from public.mgr_stats_matches s where s.match_id = m.id)
    order by kickoff_at, id
  loop
    if public.mgr_record_player_stats(v_id) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.mgr_backfill_player_stats() from public, anon, authenticated;
grant execute on function public.mgr_backfill_player_stats() to service_role;

select public.mgr_backfill_player_stats();
