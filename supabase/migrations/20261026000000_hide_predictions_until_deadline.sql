-- Other people's predictions are hidden until the deadline of their tour (D-084, replaces D-005).
-- A participant always sees their own, an admin sees all; once the tour's deadline has passed (or
-- the match is already finished) everybody sees all. The sub-select is uncorrelated, so Postgres
-- evaluates it once per query (a few dozen matches), not once per prediction row.
drop policy predictions_select on public.predictions;

create policy predictions_select on public.predictions for select to anon, authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin()
  or match_id in (
    select m.id from public.matches m
    where m.status = 'finished' or now() >= public.tour_deadline(m.tour_id)
  )
);
