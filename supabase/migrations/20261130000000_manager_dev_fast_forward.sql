-- DEVELOPMENT ONLY (D-135): fast-forwards the football manager by 11 rounds so that the owner can
-- look at the market, the money and the state of the players. Remove this file before the launch
-- (the database is reset then). It changes nothing in the rules and nothing in the code: it moves
-- the kickoff of the first rounds of every league that is in its season into the past, one day
-- apart; the next run of the scheduler (or the first visit to the section) plays them one after
-- another with the real engine, the real money and the real training.
--
-- Backward compatible: updates the kickoff times of matches that were not played yet.

create or replace function public.mgr_dev_fast_forward(p_rounds integer)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_moved integer;
begin
  -- Round r of a league moves to (p_rounds - r + 1) days ago at the same time of day.
  update public.mgr_matches m
  set kickoff_at = date_trunc('day', now() at time zone 'utc') at time zone 'utc'
                   + (m.kickoff_at - date_trunc('day', m.kickoff_at at time zone 'utc') at time zone 'utc')
                   - make_interval(days => p_rounds - m.round + 1)
  from public.mgr_leagues l
  where m.league_id = l.id and l.phase = 'season' and m.season = l.season
    and m.kind = 'league' and m.status = 'scheduled'
    and m.round <= p_rounds
    and m.kickoff_at > now() - make_interval(days => p_rounds - m.round + 1);
  get diagnostics v_moved = row_count;
  return v_moved;
end;
$$;

revoke execute on function public.mgr_dev_fast_forward(integer) from public, anon, authenticated;
grant execute on function public.mgr_dev_fast_forward(integer) to service_role;

select public.mgr_dev_fast_forward(11);
