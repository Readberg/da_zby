-- Same rule as 20261026000000, written so Postgres evaluates the admin check once per query
-- instead of once per prediction row: a function call wrapped in a sub-select becomes an InitPlan.
-- Measured on 12 000 predictions (pnpm perf:scale): the season table read got slower with the
-- per-row call of is_admin().
drop policy predictions_select on public.predictions;

create policy predictions_select on public.predictions for select to anon, authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
  or match_id in (
    select m.id from public.matches m
    where m.status = 'finished' or now() >= public.tour_deadline(m.tour_id)
  )
);
