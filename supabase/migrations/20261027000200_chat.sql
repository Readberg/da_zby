-- Common chat for signed-in users (D-098). Messages live 24 hours, then they are deleted for good:
-- reads hide anything older at once (RLS), a statement trigger and a cron job delete it physically,
-- and the table is left out of the daily backup (db-backup workflow).
-- Backward compatible: only new tables and functions.

create table public.chat_messages (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  -- Snapshot of the author, filled by the trigger below: a live message carries what Realtime
  -- needs to show it, and the rows are gone within a day anyway.
  author_nickname    text not null,
  author_avatar_path text,
  body               text not null check (char_length(btrim(body)) between 1 and 500),
  created_at         timestamptz not null default now()
);
comment on table public.chat_messages is 'Common chat. Rows older than 24 hours are invisible and deleted (purge_chat_messages). Not part of backups.';

create index chat_messages_created_at_idx on public.chat_messages (created_at desc);
create index chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);

-- Users an admin has shut out of the chat.
create table public.chat_bans (
  user_id   uuid primary key references public.profiles (id) on delete cascade,
  banned_at timestamptz not null default now(),
  banned_by uuid references public.profiles (id) on delete set null
);

alter table public.chat_messages enable row level security;
alter table public.chat_bans enable row level security;

create or replace function public.chat_is_banned(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.chat_bans where user_id = p_user);
$$;

-- Deletes messages past their day. Called by cron and after every insert.
create or replace function public.purge_chat_messages()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.chat_messages where created_at < now() - interval '24 hours';
$$;

-- Fills the author snapshot, keeps banned users and flooders out.
create or replace function public.chat_messages_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_nickname text;
  v_avatar   text;
begin
  if public.chat_is_banned(new.user_id) then
    raise exception 'chat.banned' using errcode = 'P0001';
  end if;

  select nickname::text, avatar_path into v_nickname, v_avatar
  from public.profiles where id = new.user_id;
  if v_nickname is null then
    raise exception 'chat.no_nickname' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.chat_messages
    where user_id = new.user_id and created_at > now() - interval '2 seconds'
  ) then
    raise exception 'chat.rate_limited' using errcode = 'P0001';
  end if;

  new.author_nickname := v_nickname;
  new.author_avatar_path := v_avatar;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end;
$$;

create trigger chat_messages_before_insert before insert on public.chat_messages
  for each row execute function public.chat_messages_before_insert();

create or replace function public.chat_messages_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.purge_chat_messages();
  return null;
end;
$$;

create trigger chat_messages_after_insert after insert on public.chat_messages
  for each statement execute function public.chat_messages_after_insert();

-- Signed-in users read the last 24 hours (Realtime applies the same policy), write as themselves,
-- delete their own; an admin deletes any.
create policy chat_messages_select on public.chat_messages for select to authenticated
  using (created_at > now() - interval '24 hours');

create policy chat_messages_insert on public.chat_messages for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy chat_messages_delete on public.chat_messages for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy chat_bans_admin on public.chat_bans for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.chat_messages from anon, authenticated;
revoke all on public.chat_bans from anon, authenticated;
grant select, delete on public.chat_messages to authenticated;
grant insert (user_id, body) on public.chat_messages to authenticated;
grant select, insert, delete on public.chat_bans to authenticated;

revoke execute on function public.chat_is_banned(uuid) from public, anon;
revoke execute on function public.purge_chat_messages() from public, anon, authenticated;

-- Live delivery: Realtime sends row changes of this table to subscribed signed-in clients.
alter publication supabase_realtime add table public.chat_messages;

-- Physical deletion also when nobody writes. If pg_cron is not available the insert trigger and the
-- read filter still keep the promise (nothing older than a day is readable).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('chat-purge', '*/10 * * * *', 'select public.purge_chat_messages()');
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end
$$;
