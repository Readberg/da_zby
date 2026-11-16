-- Football manager: a club can have a logo of its own (D-134). The picture lives in the public
-- "avatars" bucket, in the folder of its owner (the storage policies of that bucket already allow
-- exactly that); the club keeps only the path. Without a logo the club is shown by its colours.
-- Backward compatible: a nullable column and one function.

alter table public.mgr_clubs add column logo_path text;

-- Sets (or, with null, removes) the logo of the caller's club. The path must be a file of the
-- owner's own folder: "<user id>/<name>.<jpg|png|webp>".
create or replace function public.mgr_set_logo(p_user uuid, p_path text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.mgr_clubs where user_id = p_user) then
    raise exception 'manager.club_unknown' using errcode = 'P0001';
  end if;
  if p_path is not null and p_path !~ ('^' || p_user::text || '/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$') then
    raise exception 'manager.logo_invalid' using errcode = 'P0001';
  end if;
  update public.mgr_clubs set logo_path = p_path where user_id = p_user;
end;
$$;

revoke execute on function public.mgr_set_logo(uuid, text) from public, anon, authenticated;
grant execute on function public.mgr_set_logo(uuid, text) to service_role;
