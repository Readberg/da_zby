# Да забей (da_zby)

Сайт блога «Да забей» о белорусском спорте: турнир прогнозистов и последние видео канала.
Правила проекта — `CLAUDE.md`, документация — `docs/`.

## Запуск за 5 команд

```bash
git clone https://github.com/Readberg/da_zby.git && cd da_zby
corepack enable
pnpm install
cp .env.example .env.local   # затем заполните секреты по docs/SETUP.md
pnpm dev                     # http://localhost:3000
```

Требования: Node.js ≥ 20.9 (см. `.nvmrc`), pnpm 9 (через corepack).

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | Режим разработки |
| `pnpm build` / `pnpm start` | Production-сборка и запуск |
| `pnpm lint` | ESLint + проверка форматирования Prettier (`pnpm format` — исправить) |
| `pnpm typecheck` | Генерация типов маршрутов и проверка TypeScript |
| `pnpm test` | Unit-тесты (Vitest) |
| `pnpm test:e2e` | E2E smoke (Playwright; один раз: `pnpm exec playwright install chromium`) |
| `pnpm db:push` | Применить миграции к dev-Supabase (нужны `supabase login` и `supabase link --project-ref lrybmorjxxbogbmmpddj`) |
| `pnpm db:types` | Перегенерировать `src/types/database.ts` из привязанного проекта |
| `pnpm api:openapi` | Перегенерировать снимок `docs/api/openapi.v1.json` |
