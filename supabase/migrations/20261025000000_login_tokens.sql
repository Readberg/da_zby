-- ============================================================================
-- 0.6.0 — one-time tokens for signing in through the Telegram bot (D-056)
-- Additive migration. The table is reachable only with the secret (service) key.
-- ============================================================================

create table public.login_tokens (
  -- SHA-256 (hex) of the random token. The token itself exists only in the visitor's browser and in
  -- the bot link, so a leaked table cannot be used to open sessions.
  token_hash        text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Two-digit number shown on the site; the visitor must pick it in the bot (protects against
  -- somebody else's browser being signed in to your account through a forwarded link).
  code              text not null check (code ~ '^[0-9]{2}$'),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '10 minutes',
  -- Filled when the visitor picked the right number in the bot.
  telegram_id       text check (telegram_id ~ '^[0-9]{1,20}$'),
  telegram_username text,
  first_name        text,
  last_name         text,
  confirmed_at      timestamptz,
  -- Set when the site exchanged the token for a session: a token works once.
  consumed_at       timestamptz
);

create index login_tokens_expires_at_idx on public.login_tokens (expires_at);

alter table public.login_tokens enable row level security;
revoke all on public.login_tokens from anon, authenticated;
comment on table public.login_tokens is 'One-time Telegram bot sign-in tokens (hashed). Service key only; no RLS policies on purpose.';
