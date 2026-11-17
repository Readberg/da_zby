-- The rating of managers (DAZBY-155) sorts the real clubs by Elo, name and id and counts the clubs
-- above one club: an index of the same order and the same condition. Backward compatible: only an index.
create index if not exists mgr_clubs_rating_idx
  on public.mgr_clubs (elo desc, name, id)
  where not is_bot and league_id is not null;

-- A logo path set by the staff through the admin console (adm_edit) must have the same form as the
-- one mgr_set_logo accepts: "<uuid>/<name>.jpg|png|webp", no "..", no other folders. Backward
-- compatible: the paths in use were all written by mgr_set_logo.
create or replace function public.mgr_clubs_check_logo()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.logo_path is not null
     and new.logo_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$' then
    raise exception 'manager.logo_invalid' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists mgr_clubs_check_logo on public.mgr_clubs;
create trigger mgr_clubs_check_logo
  before insert or update of logo_path on public.mgr_clubs
  for each row execute function public.mgr_clubs_check_logo();
