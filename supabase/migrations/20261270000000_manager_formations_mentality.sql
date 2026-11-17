-- Football manager (D-145): twelve formations instead of five (they differ on the pitch only; the
-- engine counts DEF / MID / FWD) and a mentality of seven steps instead of three.
-- Old rows are converted: defense -> defensive, attack -> offensive, balanced stays.
-- Backward compatible: the check constraints are widened, the function keeps its signature.

alter table public.mgr_lineups drop constraint if exists mgr_lineups_formation_check;
alter table public.mgr_lineups drop constraint if exists mgr_lineups_mentality_check;

update public.mgr_lineups set mentality = 'defensive' where mentality = 'defense';
update public.mgr_lineups set mentality = 'offensive' where mentality = 'attack';

alter table public.mgr_lineups
  add constraint mgr_lineups_formation_check check (formation in (
    '3-4-3', '3-5-2', '3-4-1-2',
    '4-4-2', '4-3-3', '4-5-1', '4-2-3-1', '4-1-4-1', '4-4-1-1',
    '5-3-2', '5-4-1', '5-2-3'
  )),
  add constraint mgr_lineups_mentality_check check (mentality in (
    'bus', 'defensive', 'cautious', 'balanced', 'offensive', 'attacking', 'all_out'
  ));

-- How many defenders, midfielders and forwards a formation needs; null for an unknown formation.
create or replace function public.mgr_formation_counts(p_formation text)
returns int[]
language sql immutable set search_path = ''
as $$
  select case p_formation
    when '3-4-3'   then array[3, 4, 3]
    when '3-5-2'   then array[3, 5, 2]
    when '3-4-1-2' then array[3, 5, 2]
    when '4-4-2'   then array[4, 4, 2]
    when '4-3-3'   then array[4, 3, 3]
    when '4-5-1'   then array[4, 5, 1]
    when '4-2-3-1' then array[4, 5, 1]
    when '4-1-4-1' then array[4, 5, 1]
    when '4-4-1-1' then array[4, 4, 2]
    when '5-3-2'   then array[5, 3, 2]
    when '5-4-1'   then array[5, 4, 1]
    when '5-2-3'   then array[5, 2, 3]
  end;
$$;

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
  v_counts int[] := public.mgr_formation_counts(p_formation);
begin
  select id into v_club from public.mgr_clubs where user_id = p_user;
  if v_club is null then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.mgr_matches
    where status = 'scheduled' and kickoff_at - interval '5 minutes' <= now()
      and (home_club_id = v_club or away_club_id = v_club)
  ) then
    raise exception 'manager.lineup_locked' using errcode = 'P0001';
  end if;

  if v_counts is null
     or p_mentality not in ('bus', 'defensive', 'cautious', 'balanced', 'offensive', 'attacking', 'all_out')
     or cardinality(p_players) <> 11
     or (select count(distinct x) from unnest(p_players) x) <> 11
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players)) <> 11
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and injured_until > now()) > 0
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'GK') <> 1
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'DEF') <> v_counts[1]
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'MID') <> v_counts[2]
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'FWD') <> v_counts[3] then
    raise exception 'manager.lineup_invalid' using errcode = 'P0001';
  end if;

  insert into public.mgr_lineups (club_id, formation, mentality, player_ids)
  values (v_club, p_formation, p_mentality, p_players)
  on conflict (club_id) do update
    set formation = excluded.formation, mentality = excluded.mentality,
        player_ids = excluded.player_ids, updated_at = now();
end;
$$;

revoke all on function public.mgr_formation_counts(text) from public, anon, authenticated;
