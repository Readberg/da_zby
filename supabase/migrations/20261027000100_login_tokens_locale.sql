-- The bot answers in the language the visitor uses on the site (DAZBY-116). Backward compatible:
-- a new column with a default, old rows and old code keep working.
alter table public.login_tokens
  add column locale text not null default 'ru' check (locale in ('ru', 'en'));
