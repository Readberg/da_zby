-- Football manager: a lineup (and the training plans) is accepted until five minutes before the
-- kickoff of the next match of the club, not until the kickoff itself (D-134). The same two
-- functions as before, with the deadline moved; nothing else changes.
-- Backward compatible: create or replace with the same signatures.

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
  v_def  int := split_part(p_formation, '-', 1)::int;
  v_mid  int := split_part(p_formation, '-', 2)::int;
  v_fwd  int := split_part(p_formation, '-', 3)::int;
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

  if p_formation not in ('4-4-2', '4-3-3', '3-5-2', '4-5-1', '5-3-2')
     or p_mentality not in ('balanced', 'attack', 'defense')
     or cardinality(p_players) <> 11
     or (select count(distinct x) from unnest(p_players) x) <> 11
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players)) <> 11
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and injured_until > now()) > 0
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'GK') <> 1
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'DEF') <> v_def
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'MID') <> v_mid
     or (select count(*) from public.mgr_players where club_id = v_club and id = any (p_players) and position = 'FWD') <> v_fwd then
    raise exception 'manager.lineup_invalid' using errcode = 'P0001';
  end if;

  insert into public.mgr_lineups (club_id, formation, mentality, player_ids)
  values (v_club, p_formation, p_mentality, p_players)
  on conflict (club_id) do update
    set formation = excluded.formation, mentality = excluded.mentality,
        player_ids = excluded.player_ids, updated_at = now();
end;
$$;

create or replace function public.mgr_set_training(p_user uuid, p_plans jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_club uuid;
  v_plan jsonb;
  v_focus text;
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
    raise exception 'manager.training_locked' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_plans) <> 'array' or jsonb_array_length(p_plans) > 30 then
    raise exception 'manager.training_invalid' using errcode = 'P0001';
  end if;

  for v_plan in select * from jsonb_array_elements(p_plans) loop
    v_focus := v_plan ->> 'focus';
    if not exists (
      select 1 from public.mgr_players where id = (v_plan ->> 'player_id')::uuid and club_id = v_club
    ) or (
      v_focus is not null and not exists (
        select 1 from public.mgr_player_attributes
        where player_id = (v_plan ->> 'player_id')::uuid and attribute = v_focus
      )
    ) then
      raise exception 'manager.training_invalid' using errcode = 'P0001';
    end if;
    update public.mgr_players set training_focus = v_focus where id = (v_plan ->> 'player_id')::uuid;
  end loop;
end;
$$;
