-- The rating of managers (DAZBY-155) sorts the real clubs by Elo, name and id and counts the clubs
-- above one club: an index of the same order and the same condition. Backward compatible: only an index.
create index if not exists mgr_clubs_rating_idx
  on public.mgr_clubs (elo desc, name, id)
  where not is_bot and league_id is not null;
