# DATA_MODEL — схема данных

Источник истины: `supabase/migrations/*.sql`. Этот документ — карта; при изменении схемы обновлять его в том же PR.
Миграции `20261024000000_init.sql` и `20261024000100_bootstrap_admin_and_kind.sql` проверены на Postgres 16 сценариями: самоповышение роли, чужие прогнозы, дедлайн, автоподсчёт, пересчёт, закрытие и откат сезона, запрет снять последнего админа.

## Таблицы

| Таблица | Назначение | Ключевые поля |
|---|---|---|
| `profiles` | Публичный профиль (1:1 с `auth.users`) | `nickname` (citext, уникальный, NULL до онбординга), `full_name`, `contact`, `about`, `avatar_path`, `country_code`, `city`, `utc_offset_minutes` (по умолч. 180), `role` (`user`/`admin`), `created_at`, `last_login_at` |
| `profile_private` | Приватные данные | `user_id`, `email` (видит владелец и админ) |
| `tournaments` | Турниры и их настройки | `name`, `slug`, `kind` (сейчас только `score_prediction`), `points_exact` (3), `points_outcome` (1), `is_active` |
| `seasons` | Сезоны турнира | `tournament_id`, `name`, `status` (`active`/`closed`), `closed_at` |
| `clubs` | Общий справочник клубов | `name`, `short_name`, `logo_path` |
| `season_clubs` | Состав клубов сезона | `season_id`, `club_id` |
| `tours` | Туры сезона | `season_id`, `number`, `title`, `deadline_override` |
| `matches` | Матчи тура | `tour_id`, `home_club_id`, `away_club_id`, `kickoff_at`, `status` (`scheduled`/`finished`/`postponed`/`cancelled`), `home_score`, `away_score` |
| `predictions` | Прогнозы | `user_id`, `match_id`, `home_score`, `away_score`, `result` (`exact`/`outcome`/`miss`/NULL), `points` — уникально (user, match) |
| `admin_bootstrap` | Кому выдать роль админа при первом подтверждённом входе (клиентам недоступна) | `email`, `nickname` |
| `season_standings` | Зафиксированные итоговые места сезона | `season_id`, `user_id`, `final_rank`, очки и счётчики |

Представления (с `security_invoker`): `season_leaderboard`, `tour_leaderboard` — счётчики, очки, `current_rank` (rank() по очкам → точным счетам → исходам), в сезонном ещё `final_rank`, `wins_count`, `losses_count`, `win_rate`.

Storage: бакеты `avatars` (2 МБ, jpeg/png/webp, пишет владелец в свою папку `<uid>/`) и `club-logos` (1 МБ, пишет только админ). Оба публичны на чтение.

## Функции и триггеры

| Имя | Что делает |
|---|---|
| `is_admin()` | Проверка роли текущего пользователя |
| `set_user_role(target, role)` | Выдать/снять админа; нельзя снять последнего |
| `tour_deadline(tour_id)` | `deadline_override`, иначе (самое раннее начало матча тура − 10 минут) |
| `can_predict(match_id)` | Сезон активен, матч не отменён/завершён, дедлайн не прошёл |
| `grade_match()` (триггер на `matches`) | При `finished` + счёте проставляет `result`/`points` всем прогнозам матча; при выходе из `finished` — сбрасывает |
| `recalculate_season(season_id)` | Админ: пересчитать весь сезон (после смены очков турнира) |
| `close_season(season_id)` / `reopen_season(season_id)` | Зафиксировать итоговые места и закрыть сезон / откатить |
| `handle_new_user()`, `sync_auth_user()` | Создание профиля при регистрации; синхронизация email и последнего входа; вызов `apply_admin_bootstrap()` |
| `apply_admin_bootstrap(user, email, confirmed)` | Назначает админа и ник из `admin_bootstrap` **только при подтверждённой почте**; клиентам недоступна |

## Права (RLS и привилегии)

- Чтение: профили, справочники, прогнозы, рейтинги — всем, включая гостей. `profile_private` — только владелец и админ.
- Пользователь пишет: свой профиль (только колонки: ник, имя, контакт, о себе, фото, страна, город, часовой пояс — **не `role`**) и свои прогнозы (только `home_score`, `away_score`, и только пока `can_predict`). `result` и `points` клиент записать не может.
- Админ пишет: турниры, сезоны, клубы, состав, туры, матчи, логотипы клубов; вызывает функции управления.
- Первый админ: автоматически (`admin_bootstrap`: `wayreadberg@gmail.com` → роль admin, ник `Readberg`) при подтверждённом входе. Запасной ручной вариант: `update public.profiles set role = 'admin' where id = '<uuid>';` в SQL Editor.

## Известные особенности и риски

1. **Дедлайн вычисляется.** Если админ перенесёт самый ранний матч тура на более позднее время, дедлайн сдвинется вперёд. Чтобы зафиксировать, использовать `deadline_override`. Если понадобится строже — завести поле `deadline_at` и замораживать.
2. **Чужие прогнозы читаются всегда** (решение владельца, D-005): технически любой может запросить их через API до дедлайна и подсмотреть. 30-минутный кеш — только на уровне сайта. Если появятся жалобы, достаточно одной политики: скрывать чужие прогнозы до дедлайна тура.
3. **Смена очков турнира** не пересчитывает старые оценки сама — нужна кнопка «пересчитать сезон».
4. **Часовой пояс** — фиксированный сдвиг от UTC, без перехода на летнее/зимнее время (в Беларуси переходов нет).
5. Удаление клуба, у которого есть матчи, запрещено (`on delete restrict`); удаление пользователя каскадно удаляет его прогнозы.

## Процесс изменений

1. Новая миграция `supabase/migrations/<timestamp>_<что>.sql`.
2. PR в `dev` (CI запрещает править уже существующие миграции) → после мержа workflow `db-migrate` сам применяет миграцию к dev (D-047).
3. `pnpm db:types` — забрать сгенерированные типы из прогона и закоммитить.
4. Обновить этот документ и `CHANGELOG.md` (раздел «Миграции БД»).
