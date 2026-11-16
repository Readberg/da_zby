-- Football manager: removes the old mgr_record_match (DAZBY-153).
-- Since stage 3 the server plays matches with mgr_play_match / mgr_play_match_v2; nothing in the
-- code or in other SQL functions calls the old one (checked with grep), and it is not granted to
-- any role except service_role, so dropping it is safe.

drop function if exists public.mgr_record_match(uuid, smallint, smallint, jsonb, jsonb, jsonb);
