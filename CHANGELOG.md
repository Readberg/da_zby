# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии `X.Y.Z` (см. `docs/WORKFLOW.md`, «Версии и релизы»).
Новые записи — сверху. У каждой записи ключ задачи Jira. Разделы: Добавлено · Изменено · Исправлено · Удалено · Миграции БД · API.

## [Не выпущено]

### Изменено
- Единственный способ входа — Telegram (Login Widget): проверка подписи, создание аккаунта и сессия на сервере; админ по `TELEGRAM_ADMIN_IDS` (D-054, DAZBY-59).

### Удалено
- Вход по письму и через Google, маршрут `/auth/callback`, флаги `NEXT_PUBLIC_GOOGLE_AUTH`/`NEXT_PUBLIC_EMAIL_AUTH`, показ почты в профиле.

### Для владельца
- Нужны бот в @BotFather и переменные в Railway: `docs/SETUP.md`, раздел E.

## [0.2.1] — 2026-10-25

### Изменено
- Основной вход — Google; вход по письму скрыт флагом `NEXT_PUBLIC_EMAIL_AUTH=1`, кнопка Google включается `NEXT_PUBLIC_GOOGLE_AUTH=1`. Пока не включён ни один способ, страница входа сообщает, что вход временно недоступен (D-053, DAZBY-58).

### Для владельца
- Чтобы войти, нужно настроить Google (`docs/SETUP.md`, раздел E) и добавить в Railway `NEXT_PUBLIC_GOOGLE_AUTH=1`.

## [0.2.0] — 2026-10-24

Вход и профили (эпик E3).

### Добавлено
- Вход по ссылке из письма, выход, маршруты /auth/callback и /auth/confirm, меню пользователя в шапке (DAZBY-43…45).
- Онбординг: выбор ника один раз; первый админ получает ник и роль автоматически (DAZBY-46).
- Страница «Профиль» с редактированием и публичная страница /u/<ник> без приватных данных (DAZBY-48, 50).
- Фото профиля: загрузка, замена и удаление (jpeg/png/webp до 2 МБ) (DAZBY-49).
- Кнопка «Войти через Google» — скрыта, пока не задан NEXT_PUBLIC_GOOGLE_AUTH=1 (DAZBY-51).
- e2e-тесты для вошедшего пользователя через Admin API; пропускаются без SUPABASE_SECRET_KEY (DAZBY-52).

### API
- GET/PATCH /api/v1/me, GET /api/v1/nicknames/{nickname}/availability; поддержка тела запроса (DAZBY-47).

### Для владельца
- Вход работает только после настройки Supabase (Site URL, Redirect URLs, шаблоны писем): `docs/OWNER_TODO.md`, A1–A2.

## [0.1.1] — 2026-10-24

### Исправлено
- Главная писала в лог сервера ошибку Cache Components на каждый запрос (`Date.now()` в кеше видео при пререндере): загрузка видео помечена как данные времени запроса (DAZBY-38).

### Добавлено
- Ссылки на Telegram, Instagram, TikTok и Threads в подвале (DAZBY-25).
- Автотесты вместо ручных проверок: e2e API, вёрстки, доступности, безопасности; сторож «нет зашитых цветов»; проверка секретов в клиентском бандле в CI (DAZBY-38).
- Workflow `db-migrate`: миграции применяются к dev-Supabase из GitHub Actions; CI запрещает править существующие миграции (DAZBY-40).

### Изменено
- Процесс: ручная проверка владельцем только ключевая (🔑), остальное — автотесты (D-046).

## [0.1.0] — 2026-10-24

Каркас, тема и главная с видео канала (эпики E1 «Фундамент», E2 «Главная и видео»).

### Добавлено
- Проект Next.js 16 (App Router, Cache Components) + TypeScript strict + Tailwind 4 + pnpm; README с запуском за 5 команд (DAZBY-10).
- ESLint + Prettier, Vitest (unit/contract), Playwright (e2e smoke на 360 и 1280 px) (DAZBY-11).
- CI на GitHub Actions: lint, typecheck, test, build, e2e (DAZBY-12).
- Проверка переменных окружения при старте (Zod), разделение публичных и серверных (DAZBY-13).
- Клиенты Supabase (`@supabase/ssr`) и обновление сессии в `proxy.ts`; для гостей запросов к Supabase нет (DAZBY-14).
- Типы БД `src/types/database.ts` (вручную по миграциям, до перегенерации), скрипты `db:push`/`db:types` (DAZBY-15, частично).
- Токены темы, шрифты Oswald/Inter с кириллицей, отключённая стандартная палитра Tailwind (DAZBY-17).
- UI-компоненты: Button, TextField, Card, ResultBadge, Table, Container, Skeleton; витрина `/styleguide` (только dev) (DAZBY-18).
- Каркас: шапка, подвал с соцсетями из конфига, страницы 404 и ошибки, тексты в `ru.ts` (DAZBY-19).
- Библиотека дизайна: `pnpm design:snap`, снимки компонентов и экранов, каталог `COMPONENTS.md` (DAZBY-20).
- Главная «Свежие видео»: ленивый плеер `youtube-nocookie`, 5 предыдущих видео, скелетон, запасной блок при недоступности YouTube (DAZBY-22).
- SEO: метаданные, Open Graph 1200×630, иконки из логотипа, `sitemap.xml`, `robots.txt` (DAZBY-23).

### Исправлено
- Нестабильный unit-тест плеера в CI: заглушка `scrollIntoView` для jsdom перенесена в общий setup (DAZBY-22).

### API
- Внутренний API v1 (`/api/v1`): `withApi`, конверт `{ data, meta }`, ошибки problem+json, `X-Request-Id`, `API-Version: 1`; `GET /health`, `/version`, `/openapi.json`; неизвестная версия → `404 api.version_unsupported` (DAZBY-16).
- `GET /api/v1/videos?limit=` — последние видео канала без Shorts, кеш 1 ч, `503 videos.unavailable` (DAZBY-21).
- Снимок контракта: `docs/api/openapi.v1.json`.

### Миграции БД
- В репозитории: `20261024000000_init.sql`, `20261024000100_bootstrap_admin_and_kind.sql`. **К dev-проекту пока не применены** (ждут владельца, DAZBY-15). Ни одна функция 0.1.0 от БД не зависит; `/api/v1/health` показывает `checks.database = "error"` до применения.
