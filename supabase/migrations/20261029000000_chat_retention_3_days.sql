-- Chat messages live 3 days instead of 24 hours (owner's decision, D-126; it replaces the term of D-098).
-- Backward compatible: only the term changes, nothing is deleted and no table or column is touched.
-- A longer term can only make more rows visible, so the code of the previous release keeps working.

comment on table public.chat_messages is 'Common chat. Rows older than 3 days are invisible and deleted (purge_chat_messages). Not part of backups.';

-- Called by cron and after every insert; grants stay as they were (create or replace keeps them).
create or replace function public.purge_chat_messages()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.chat_messages where created_at < now() - interval '72 hours';
$$;

-- Signed-in users read the last 3 days (Realtime applies the same policy).
drop policy chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages for select to authenticated
  using (created_at > now() - interval '72 hours');
