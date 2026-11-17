-- Bringing a club back from deactivation (DAZBY-152): the "dormant" column exists since 20261203, so the
-- function no longer checks for it, and it also clears dormant_since like mgr_confirm_return does.
-- Backward compatible: create or replace of the same signature.
create or replace function public.adm_reactivate_club(p_actor uuid, p_club uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_old boolean;
begin
  perform public.adm_require(p_actor, 'admin');
  perform public.adm_need_reason(p_reason);
  select dormant into v_old from public.mgr_clubs where id = p_club for update;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  update public.mgr_clubs set dormant = false, dormant_since = null where id = p_club;
  perform public.adm_log(p_actor, 'reactivate_club', 'clubs', p_club::text,
    jsonb_build_object('dormant', v_old), jsonb_build_object('dormant', false), p_reason);
  return jsonb_build_object('before', jsonb_build_object('dormant', v_old), 'after', jsonb_build_object('dormant', false));
end;
$$;

revoke execute on function public.adm_reactivate_club(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.adm_reactivate_club(uuid, uuid, text) to service_role;
