-- Football manager, stage 3, part 1 (D-129, docs/MANAGER.md): injuries, training and the changes that
-- a played match makes to the players (form, fitness, morale, growth).
-- Backward compatible: new columns with defaults and new functions; mgr_record_match stays as it is
-- (the code now calls mgr_play_match, which also writes the effects in the same transaction);
-- mgr_save_lineup only gets stricter (an injured player cannot be chosen).

alter table public.mgr_players add column injured_until timestamptz;
alter table public.mgr_players add column idle_rounds smallint not null default 0 check (idle_rounds >= 0);
-- The attribute a player trains (null = rests); it must be one of the player's own attributes.
alter table public.mgr_players add column training_focus text;
comment on column public.mgr_players.injured_until is 'Injured (cannot play or train) until this moment; null or past = fit.';
comment on column public.mgr_players.idle_rounds is 'Rounds in a row without playing; every third one costs morale.';

-- Writes the result of a match and what it did to the players, once and in one transaction.
-- p_effects: [{ id, form, fitness, morale, idle_rounds, ovr, injured_until?, attributes?: { key: value } }].
-- Returns false (and changes nothing) when the match was already written by another runner.
create or replace function public.mgr_play_match(
  p_match       uuid,
  p_home_goals  smallint,
  p_away_goals  smallint,
  p_events      jsonb,
  p_home_lineup jsonb,
  p_away_lineup jsonb,
  p_effects     jsonb
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_home  uuid;
  v_away  uuid;
  v_done  integer;
  v_effect jsonb;
  v_attr  record;
begin
  update public.mgr_matches
  set status = 'finished', home_goals = p_home_goals, away_goals = p_away_goals,
      events = p_events, home_lineup = p_home_lineup, away_lineup = p_away_lineup, played_at = now()
  where id = p_match and status = 'scheduled' and kickoff_at <= now()
  returning home_club_id, away_club_id into v_home, v_away;
  get diagnostics v_done = row_count;
  if v_done <> 1 then
    return false;
  end if;

  if jsonb_typeof(p_effects) = 'array' then
    for v_effect in select * from jsonb_array_elements(p_effects) loop
      update public.mgr_players p
      set form = (v_effect ->> 'form')::smallint,
          fitness = (v_effect ->> 'fitness')::smallint,
          morale = (v_effect ->> 'morale')::smallint,
          idle_rounds = (v_effect ->> 'idle_rounds')::smallint,
          ovr = (v_effect ->> 'ovr')::smallint,
          injured_until = case
            when v_effect ->> 'injured_until' is not null then (v_effect ->> 'injured_until')::timestamptz
            else p.injured_until
          end
      where p.id = (v_effect ->> 'id')::uuid and p.club_id in (v_home, v_away);

      if jsonb_typeof(v_effect -> 'attributes') = 'object' then
        for v_attr in select key, value from jsonb_each_text(v_effect -> 'attributes') loop
          update public.mgr_player_attributes a
          set value = v_attr.value::smallint
          where a.player_id = (v_effect ->> 'id')::uuid and a.attribute = v_attr.key
            and exists (
              select 1 from public.mgr_players p
              where p.id = a.player_id and p.club_id in (v_home, v_away)
            );
        end loop;
      end if;
    end loop;
  end if;
  return true;
end;
$$;

-- Sets what the players of the caller's club train: [{ player_id, focus }], focus null = rest.
-- Locked from the kickoff of a due round, like the lineup.
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
    where status = 'scheduled' and kickoff_at <= now()
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

-- The lineup check of stage 2, plus: nobody injured.
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
    where status = 'scheduled' and kickoff_at <= now()
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

revoke execute on function public.mgr_play_match(uuid, smallint, smallint, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.mgr_set_training(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mgr_play_match(uuid, smallint, smallint, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.mgr_set_training(uuid, jsonb) to service_role;
