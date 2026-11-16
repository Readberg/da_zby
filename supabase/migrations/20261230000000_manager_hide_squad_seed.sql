-- SECURITY (DAZBY-154): mgr_clubs rows of the whole league are readable, and squad_seed regenerates
-- the first squad together with the hidden potentials (generateSquad is deterministic). The seed
-- moves to a table nobody but the server can read; the column stays (backward compatible) but is
-- emptied, and a trigger keeps it empty for every new club (mgr_create_club and mgr_open_league
-- are not touched).

create table public.mgr_club_seeds (
  club_id    uuid primary key references public.mgr_clubs (id) on delete cascade,
  squad_seed text not null
);
alter table public.mgr_club_seeds enable row level security;
revoke all on public.mgr_club_seeds from anon, authenticated;

insert into public.mgr_club_seeds (club_id, squad_seed)
select id, squad_seed from public.mgr_clubs where squad_seed is not null;

alter table public.mgr_clubs alter column squad_seed drop not null;
update public.mgr_clubs set squad_seed = null where squad_seed is not null;

create or replace function public.mgr_club_seed_move()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.squad_seed is not null then
    insert into public.mgr_club_seeds (club_id, squad_seed) values (new.id, new.squad_seed);
    update public.mgr_clubs set squad_seed = null where id = new.id;
  end if;
  return null;
end;
$$;
revoke execute on function public.mgr_club_seed_move() from public, anon, authenticated;

create trigger mgr_clubs_seed_move after insert on public.mgr_clubs
  for each row execute function public.mgr_club_seed_move();
