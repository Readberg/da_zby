# API — внутренний API с версионированием

Статус: решение владельца — внутренний API и мультиверсионность внедряем сразу. Здесь — минимально достаточная реализация по лучшим практикам; всё «на вырост» помечено как отложенное.

## Зачем

Единый контракт между фронтендом и бэкендом: на него встанут сайт, будущее мобильное приложение, Telegram-бот и другие турниры. Менять внутренности можно, не ломая клиентов.

## Слои

```
Браузер / внешний клиент
   │  fetch /api/v1/...                       страницы-RSC читают сервисы напрямую (без HTTP-прыжка)
   ▼                                              │
src/app/api/v1/**/route.ts   ← тонкий handler: auth + валидация + вызов сервиса + DTO
   ▼                                              ▼
src/server/api/v1/{schemas,dto,...}          src/server/services/*  ← вся бизнес-логика, версионно-независима
                                                   ▼
                                            Supabase (RLS работает от имени пользователя)
```

Правила:
- Логика только в `services/`. Handlers и компоненты логики не содержат.
- Сервис получает Supabase-клиент пользователя (RLS включена); secret-ключ — только для операций, невозможных под RLS, и только внутри `services` с пометкой `server-only`.
- DTO версии — отдельные мапперы: изменение БД или сервиса не должно протекать наружу.
- Клиентские компоненты и все мутации ходят через типизированный клиент `src/lib/api-client.ts` (версия — константа `API_VERSION`). Исключение: вход (Supabase Auth) и загрузка файлов в Storage — напрямую, под RLS.

## Соглашения v1

- База: `/api/v1`. Ресурсы — существительные во множественном числе, kebab-case: `/tournaments`, `/seasons/{id}/tours`.
- Формат: JSON, поля `camelCase` (в БД `snake_case`, маппинг в DTO).
- Успех: `{ "data": …, "meta": { … } }`. Списки: `meta: { limit, nextCursor }` (курсорная пагинация, `limit` по умолчанию 20, максимум 100).
- Ошибки: **RFC 9457** `application/problem+json`: `type, title, status, detail, instance, code` (стабильный машинный код, например `prediction.deadline_passed`), `errors[]` для полей формы, `requestId`.
- Заголовки ответа: `X-Request-Id`, `API-Version: 1`, явный `Cache-Control`.
- Порядок проверок: сначала вход (401/403), потом параметры и тело (400/422).
- Методы: `GET` безопасен; запись прогноза — `PUT /matches/{id}/prediction` (идемпотентна); `PATCH` для частичных обновлений; коды 200/201/204/400/401/403/404/409/422/429/500.
- Время в ответах — ISO 8601 в UTC (`2026-10-24T12:00:00Z`); переводом в пояс пользователя занимается клиент.
- Идентификаторы — UUID; для турниров допустим slug в пути.
- Авторизация: cookie-сессия Supabase (браузер) **или** `Authorization: Bearer <access token>` (внешние клиенты; запросы к базе идут от имени владельца токена, права решает RLS, DAZBY-119). Уровни доступа handler'а: `public | user | admin` — через единую обёртку `withApi({ auth, input, output })`.
- CORS закрыт по умолчанию; белый список источников — через конфиг.

## Версионирование и несколько версий одновременно

- Версия — **в пути** (`/api/v1`, `/api/v2`), мажорная. Каждая версия — своя папка `src/server/api/vN/` и своя ветка `src/app/api/vN/`. Сервисы общие.
- **Без новой версии допустимо** (обратно совместимо): добавить эндпоинт, необязательный параметр, новое поле в ответе. Клиенты обязаны игнорировать неизвестные поля.
- **Требует новой версии**: удалить/переименовать поле или эндпоинт, сменить тип, смысл, обязательность, формат ошибок.
- Устаревание: у старой версии в ответах `Deprecation: true`, `Sunset: <дата>`, `Link: <…/v2/…>; rel="successor-version"`; запись в `CHANGELOG.md` и `DECISIONS.md`. Одновременно живут не более **двух** мажорных версий; срок жизни старой — не меньше 6 месяцев с объявления **и** пока не мигрированы все известные клиенты (включая наш фронтенд).
- Служебные эндпоинты (есть с первого релиза): `GET /api/v1/health` (живость и проверка БД), `GET /api/v1/version` (версия приложения, поддерживаемые версии API, дата сборки), `GET /api/v1/openapi.json`.
- Запрос к неизвестной версии (`/api/v9/...`) — `404 problem+json` с кодом `api.version_unsupported` и списком поддерживаемых.

## Контракт и тесты

- OpenAPI генерируется из Zod-схем (инструмент — на выбор исполнителя, запись в `DECISIONS.md`), отдаётся на `/api/v1/openapi.json`, снимок хранится в `docs/api/openapi.v1.json`. `pnpm api:openapi` перегенерирует; в CI проверка «снимок актуален». Изменение снимка внутри версии, которое выглядит ломающим, — стоп и согласование.
- Contract-тесты: каждый эндпоинт проверяется на соответствие схеме (успех и ошибки). Права проверяются для гостя, пользователя и админа.

## Совместимость с БД

Пока жива версия API, схема БД меняется по схеме **expand → migrate → contract**: сначала добавляем (новые колонки/таблицы), переводим код и данные, и только в следующем релизе убираем старое. Разрушающая миграция — ключевое решение.

## Реализация v1 (DAZBY-16)

| Что | Где |
|---|---|
| Реестр эндпоинтов (метод, путь, уровень доступа, схемы, `Cache-Control`) — единый источник для handlers и OpenAPI | `src/server/api/v1/endpoints.ts` |
| Обёртка `withApi(endpoint, handler)`: `X-Request-Id` (входящий принимается, если `[\w-]{1,128}`), `API-Version: 1`, проверка `query` (422 + `errors[]`), уровни `public/user/admin` (cookie или `Bearer`), проверка ответа по схеме, конверт `{ data, meta }`, ошибки → problem+json | `src/server/api/v1/with-api.ts` |
| problem+json: `type = urn:da-zby:problem:<code>`, коды в `ERROR_CODES` | `src/server/api/v1/problem.ts` |
| OpenAPI 3.1 из Zod (`z.toJSONSchema`), снимок `docs/api/openapi.v1.json`, `pnpm api:openapi`; contract-тест падает, если снимок устарел | `src/server/api/v1/openapi.ts` |
| Неизвестная версия → `404 api.version_unsupported` (+ `supportedVersions`); неизвестный ресурс известной версии → `404 api.not_found` (все методы) | `src/app/api/[version]/[[...path]]/route.ts` |

Служебные эндпоинты: `/health` — `data.status = "ok"`, пока приложение отвечает; `data.checks.database` = `ok`/`error` (проба `select id from tournaments limit 1`, таймаут 2 с; HTTP-статус остаётся 200). `/version` — `version` из `package.json`, `apiVersions`, `buildDate` (время сборки), `commit` (коммит запущенной сборки; `null`, если хост не сообщает). `/openapi.json` — документ без конверта.

Коды ошибок v1: `api.version_unsupported`, `api.not_found`, `api.validation_failed`, `api.internal_error`, `auth.required`, `auth.forbidden`, `videos.unavailable`.

### `GET /api/v1/videos` (DAZBY-21)

Последние обычные видео канала (без Shorts), новые первыми. `?limit=1..100` (по умолчанию 20; RSS отдаёт максимум 15). Элемент: `id`, `title`, `publishedAt` (UTC), `thumbnailUrl` (480×360), `url`. `meta: { limit, nextCursor: null }`.
Источник — RSS (D-027, D-045): плейлист длинных видео `UULF…`, при сбое — фид канала с фильтром Shorts. Кеш в памяти процесса 1 час; при недоступности YouTube отдаётся последний удачный список, без него — `503 videos.unavailable`. `Cache-Control: public, max-age=300`.

### Профиль (DAZBY-47)

| Эндпоинт | Доступ | Что делает |
|---|---|---|
| `GET /me` | user | Свой профиль: ник, имя, контакт, о себе, `avatarUrl`, страна (ISO), город, `utcOffsetMinutes`, роль, `email` (виден только владельцу), даты |
| `PATCH /me` | user | Частичное обновление. Поля: `nickname`, `fullName`, `contact`, `about` (≤ 1000), `countryCode` (из списка ISO или `null`), `city`, `utcOffsetMinutes` (−720…840). Пустая строка очищает текстовое поле. Роль и email изменить нельзя (лишние поля игнорируются). **Ник можно менять в любой момент** (D-061); занятый → `409 profile.nickname_taken`. Код `profile.nickname_locked` больше не возвращается (оставлен в списке для совместимости) |
| `GET /nickname-availability?nickname=` | public | `{ valid, available }`; проверка без учёта регистра |

Тело запроса описано в OpenAPI (`requestBody`); невалидный JSON → `400 api.invalid_json`, нарушение схемы → `422 api.validation_failed` с `errors[]`. Ответы `/me` — `Cache-Control: private, no-store`.
Код `system.degraded` (503) — строгая проверка `/health/strict`: сломана база данных или вебхук входа через Telegram.

Новые коды: `api.invalid_json`, `profile.not_found`, `profile.nickname_taken`, `profile.nickname_locked`.

### Админка: пользователи (DAZBY-60)
- `GET /api/v1/admin/users?search=&page=&pageSize=` (admin): `{ items, total, page, pageSize }`, новые сверху; `search` — часть ника или имени.
- `PATCH /api/v1/admin/users/profile` (admin): `{ userId, patch }` — правка чужого профиля теми же полями, что `PATCH /me` (фото — только `avatarPath: null`); занятый ник — 409 `profile.nickname_taken`, нет участника — 404. Запись выполняется ключом сервера; журнал `admin.profile_updated` (кто, кого, какие поля).
- **Консоль админа (D-139, уровень `staff` = админ или модератор; детали и права — `docs/ADMIN.md`)**: `GET /admin/console/records?entity&q&sort&dir&filters&page&pageSize` — страница записей сущности из реестра; `GET /admin/console/record?entity&id` — запись; `PATCH /admin/console/record` `{ entity, id, patch, reason }` — правка полей (роль проверяется по каждому полю в БД, `reason` ≥ 5 символов, запись в `admin_audit` в той же транзакции; модератор на поле админа — 403); `POST /admin/console/actions` `{ action, targets[], reason, params }` — действие над одной или многими целями (массово только `freeze_market`, `unfreeze_market`, `remove_logo`), ответ — результат по каждой цели; `GET /admin/console/suspicious` — отчёт о подозрительной активности; `POST /admin/console/suspicious/review` `{ kind, subject, note }` — «проверено».
- `PATCH /api/v1/admin/users/role` (admin): тело `{ userId, role: user | admin }`; последнего админа снять нельзя — 409 `admin.last_admin`. Права проверяются трижды: `withApi` (уровень admin → `is_admin()`), RLS и сама функция `set_user_role`.

### Админка: турниры и клубы (DAZBY-61, 62)
- `GET|POST|PATCH /api/v1/admin/tournaments` (admin): список; создание `{ name, slug, pointsExact, pointsOutcome, isActive }`; частичное изменение по `id` (тело `{ id, …поля }`). Занятые slug/название — 409 `admin.duplicate` с `errors[].field`.
- `POST /api/v1/admin/tournaments/recalculate` (admin): тело `{ tournamentId }` — пересчитать все сезоны турнира после смены очков (`recalculate_season`); ответ `{ seasons }`.
- `GET|POST|PATCH|DELETE /api/v1/admin/clubs` (admin): справочник клубов (`name`, `shortName`, `logoPath`, `logoUrl`). Логотип загружается прямо в бакет `club-logos` (только админ, до 1 МБ, jpeg/png/webp) и привязывается через `logoPath`. Удаление клуба с матчами — 409 `admin.in_use`.
- Изменение и удаление идут по `id` в теле (путевых параметров в v1 пока нет).

### Рейтинг и статистика (DAZBY-67…69)
Отдельного API нет: страницы `/rating` и профиль читают представления БД `season_leaderboard` и `tour_leaderboard` через сервис (RSC) анонимным ключом — рейтинг публичный (D-005). Параметры `/rating`: `tournament` (slug), `season` (id), `tour` (номер; без него — таблица сезона).
- Кеш общих данных — 30 минут (`'use cache'`, тег `rating`). Любое изменение админки (результат матча, туры и матчи, состав, закрытие/откат/пересчёт сезона, турниры, клубы) сбрасывает кеш сразу (`invalidateRating`); свои прогнозы кешу не подвержены.

### Прогнозы (DAZBY-65, 66)
- `PUT /api/v1/predictions` (участник): тело `{ tourId, items: [{ matchId, homeScore, awayScore }] }`, счёт — целые 0–99. Новые прогнозы вставляются, существующие обновляются, пользователь берётся только из сессии. Если приём закрыт (сезон закрыт, матч сыгран или отменён, дедлайн прошёл) — 409 `predictions.closed` (решает БД: `can_predict` в RLS). Матч не из этого тура — 422. Очки по матчу считает триггер БД после ввода результата.
- Страница `/predictions` читает данные напрямую через сервис (RSC), параметры адреса: `tournament` (slug), `season` (id), `tour` (номер).

### Чат (DAZBY-117, D-098)
- `GET /api/v1/chat` (вошедший): `{ messages, banned }` — последние 3 дня (D-126), старые сверху. Живые обновления идут не через API, а через Supabase Realtime (канал изменений таблицы `chat_messages`, права по RLS); этот эндпоинт — первая загрузка и восстановление после обрыва.
- `POST /api/v1/chat` (вошедший): тело `{ body }`, 1–500 символов после обрезки пробелов. Автор берётся из сессии. Ошибки: 403 `chat.banned`, 409 `chat.no_nickname`, 429 `api.too_many_requests` (одно сообщение в 2 секунды), 422.
- `DELETE /api/v1/chat` (вошедший): тело `{ id }`; автор удаляет своё, админ любое; чужое — 404.
- `PUT /api/v1/admin/chat/bans` (админ): тело `{ userId, banned }`, идемпотентно.

### Футбольный менеджер (DAZBY-143, D-129)
Все эндпоинты — для вошедшего. `GET /manager/cities` — города страны клуба и палитра цветов. `GET /manager/club` — мой клуб и состав (`club: null`, пока клуба нет; потенциал игроков не отдаётся). `POST /manager/club` (`name`, `cityId`, `primaryColor`, `secondaryColor`) — создаёт клуб и один раз генерирует стартовый состав; `409 manager.club_exists`, `409 manager.name_taken`, 10 попыток за 10 минут. `GET /manager/player?id=` — игрок моего клуба со всеми характеристиками; чужой — `404`.

Этап 2 (DAZBY-144): `GET /manager/league` — таблица моей лиги по сыгранным матчам; `GET /manager/matches` — 38 матчей моего клуба; `GET /manager/match?id=` — матч лиги с хроникой и составами (после игры); `GET`/`PUT /manager/lineup` — состав, которым играет клуб (`saved: false` — выбран автосостав), сохранение: 11 игроков по линиям расстановки, `409 manager.lineup_locked` после начала тура. `GET /manager/club` дополнен полями `leagueNumber` и `nextMatch`. Туры играет `POST /api/cron/manager` (не часть v1, секрет `CRON_SECRET`); без него тур играется при первом заходе в раздел после 10:00 МСК.

Этап 3 (DAZBY-145): `PUT /manager/training` — что тренирует каждый игрок (характеристика его позиции или `null` — отдых), `409 manager.training_locked` после начала тура. У игроков в `GET /manager/club` появились `injuredUntil` и `trainingFocus`; в хронике матча — событие `injury`.

Этап 3, часть 2 (DAZBY-146): `POST /manager/friendly` — товарищеский матч со случайным соперником лиги (только предсезонка; `409 manager.friendly_unavailable`, `409 manager.friendly_busy`). Матчи получили поле `kind` (`league`/`friendly`), таблица и список матчей относятся к текущему сезону; у лиги и клуба есть `season`, `phase`, `preseasonEndsAt`; у игроков `retiring`. `POST /api/cron/manager` теперь ещё закрывает сезон, ведёт дни предсезонки и открывает новый сезон.

Этап 4, часть 1 (DAZBY-147): `GET /manager/finance` — бюджет, стоимость состава, зарплата за тур и журнал операций (60 последних); `GET /manager/market` — свободные игроки лиги и открыт ли рынок; `POST /manager/market/buy` (`playerId`) — купить по номиналу (`409 manager.market_closed`, `manager.player_unavailable`, `manager.squad_full`, `manager.no_money`). У клуба есть `budget`, у игрока `nominal`. `POST /api/cron/manager` ещё раз в месяц добавляет пулы свободных игроков.

Рейтинг Эло (DAZBY-155, D-142): `GET /manager/rating?scope=all|league&page=&pageSize=` — реальные клубы по Эло (боты не показываются), `{ items[{ rank, clubId, name, colors, logoUrl, leagueNumber, elo, eloPeak, isMine }], total, page, pageSize, mine{ rank, elo } }`; `scope=league` — только своя лига, `mine` — место в общем рейтинге. Обратно-совместимо: в `GET /manager/club` у клуба появились `elo` и `eloPeak`, в строках `GET /manager/league` — `elo` (у ботов тоже). Эло считаются только матчи чемпионата.

Статистика игроков (DAZBY-153, D-140): `GET /manager/player/stats?id=` — статистика игрока **своей лиги** (своего или чужого клуба): строки по сезонам и клубам и итог карьеры; игрок другой лиги или без клуба — `404`. `GET /manager/league/scorers` — до 30 лучших бомбардиров лиги в текущем сезоне (голы, затем передачи, затем меньше матчей). В хронике матча у событий `goal`/`save`/`miss`/`injury` появились необязательные `pid` и `aid` (id игроков; у старых матчей их нет). Считаются только лиговые матчи; движок не знает карточек, замен и оценок, поэтому их нет.

Схемы и настрой (DAZBY-165, D-145): в `GET/PUT /manager/lineup` поле `formation` принимает 12 схем (3-4-3, 3-5-2, 3-4-1-2, 4-4-2, 4-3-3, 4-5-1, 4-2-3-1, 4-1-4-1, 4-4-1-1, 5-3-2, 5-4-1, 5-2-3), поле `mentality` — `bus | defensive | cautious | balanced | offensive | attacking | all_out` (раньше `balanced | attack | defense`: `defense` стал `defensive`, `attack` — `offensive`; старые значения не принимаются).

Интерфейс менеджера (DAZBY-149): `PUT /manager/club/logo` (`path` в своей папке бакета `avatars` или `null`); у клуба, соперников матчей и строк таблицы есть `logoUrl`; у состава `lockAt` (приём составов закрывается за 5 минут до матча, `locked` считается по нему), `409 manager.lineup_locked` и `manager.training_locked` теперь с этого момента.
Этап 4, часть 2 (DAZBY-148): **аукцион** — `GET /manager/auctions` (открытые лоты лиги с минимальной следующей ставкой), `POST /manager/auctions` (`playerId`, `price` от 0,5 до 2 номиналов, `stepPercent` 10/20/30), `POST /manager/auctions/bid` (`auctionId`, `amount`), `POST /manager/auctions/cancel` (пока нет ставок); итоги подводятся раз в день в 10:00 МСК: выигрывает наибольшая ставка. **Контракты** — `GET /manager/contracts`, `POST /manager/contracts/extend` (`playerId`, `seasons` 1–3; игрок может отказаться — ответ `result`), `POST /manager/contracts/terminate` (неустойка 2/3 зарплат за оставшиеся туры). **Обмен** — `GET /manager/trades`, `GET /manager/trades/club?clubId=` (состав другого клуба лиги), `POST /manager/trades` (`toClubId`, `give`, `take` по 1–3 игрока, `cash` со знаком), `POST /manager/trades/accept|decline|cancel` (`tradeId`). Ошибки: 409 `manager.bid_too_low|own_auction|bid_leading|auction_closed|has_bids|player_locked|contract_ending|squad_min|squad_size|lots_limit|deal_limit|trade_closed|offer_used`, 422 `manager.price_invalid|step_invalid|cash_invalid|trade_invalid|contract_invalid`, 404 `manager.auction_unknown|trade_unknown`.

### Админка: сезоны, туры, матчи (DAZBY-63, 64)
Все эндпоинты — только админ; изменение и удаление идут по `id` в теле.
- `GET|POST /admin/seasons`: список (с числом клубов и туров) и создание `{ tournamentId, name, copyFromSeasonId? }` (состав можно скопировать с другого сезона). Занятое название — 409 `admin.duplicate`.
- `GET /admin/season?seasonId=`: сезон, состав (`clubIds`) и туры с дедлайном (`deadlineAt` — ручной или «за 10 минут до первого матча»).
- `PUT /admin/seasons/clubs`: заменить состав; клуб с матчами сезона убрать нельзя — 409 `admin.in_use`.
- `POST /admin/seasons/close|reopen|recalculate`: закрыть (фиксирует итоговые места), откатить закрытие, пересчитать очки. Неверное состояние — 409 `admin.season_state`.
- Закрытый сезон только для чтения: любые правки составa, туров и матчей — 409 `admin.season_closed`.
- `POST|PATCH|DELETE /admin/tours`, `GET /admin/tour?tourId=`: туры (номер по умолчанию — следующий, ручной дедлайн `deadlineOverride`). Тур с матчами не удаляется (409 `admin.in_use`).
- `GET|POST /admin/fixtures` (admin): импорт расписания и результатов тура из TheSportsDB (D-090). `GET ?tourId=&round=` — предпросмотр (по каждому матчу: `create` / `update` / `same` / `blocked` с причиной; ничего не пишется); `POST { tourId, round?, keys }` — применить подтверждённые строки (источник читается заново, клиент передаёт только ключи). Сбой источника — 502 `fixtures.unavailable`.
- `POST|PATCH|DELETE /admin/matches`: матч (клубы только из состава сезона, `kickoffAt` — момент времени в UTC). Результат: `status: finished` + `homeScore`/`awayScore` (итог с доп. временем, без пенальти); другой статус обнуляет счёт. Очки считает триггер БД. Матч с прогнозами не удаляется — ставьте «отменён».

### Вход через Telegram (D-056)
- `POST /api/v1/auth/telegram/miniapp` (публичный, D-128): тело `{ initData }` — подписанные данные запуска Telegram Mini App без изменений; проверяется подпись токеном бота и свежесть (не старше часа); ставит cookie сессии и отвечает `{ signedIn: true }`; 401 `auth.required` (подпись неверна или данные устарели), 422, 429 (20 попыток за 10 минут с адреса), 503 `auth.telegram_unavailable`.
- `POST /api/v1/auth/telegram/start` (публичный): создаёт попытку, отвечает `{ token, code, appUrl, webUrl, expiresInSeconds }`; 429 `api.too_many_requests` при слишком большом числе незавершённых попыток или при более чем 10 попытках за 10 минут с одного адреса, 503 `auth.telegram_unavailable`, если вход не настроен.
- `GET /api/v1/auth/telegram/status?token=` (публичный): `{ status: pending | confirmed | expired }`. При `confirmed` браузер переходит на `/auth/telegram?token=…` (не часть API: ставит cookie сессии).
- Вебхук бота `/api/telegram/webhook` — не часть публичного контракта (вызывает только Telegram).

## Отложено (не делать без задачи)

Rate limiting (когда появится публичный доступ и трафик), ключи API для внешних клиентов, webhooks, GraphQL, SDK-генерация. Заглушки и «на вырост» не писать.

## План ресурсов (ориентир, не контракт)

`GET /videos` · `GET /me`, `PATCH /me` · `GET /tournaments`, `GET /tournaments/{slug}/seasons` · `GET /seasons/{id}/tours`, `GET /tours/{id}/matches` · `PUT /matches/{id}/prediction` · `GET /seasons/{id}/leaderboard`, `GET /tours/{id}/leaderboard` · `POST/PATCH` админских ресурсов под `/admin/...`.
