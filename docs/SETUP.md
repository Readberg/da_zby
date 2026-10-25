# SETUP — что нужно сделать владельцу (пошагово)

Это то, чего Claude сам сделать не может: входы в ваши кабинеты, ключи, настройки в интерфейсах.
Названия кнопок в сервисах иногда меняются; если пункт выглядит иначе — ищите по смыслу или спросите Claude. **Секреты вставляйте только в файл `.env.local` на своей машине (или в переменные Railway), в чат и Jira их не пишите.**

Приоритет: 🔴 нужно сразу · 🟡 понадобится позже · 🟢 в самом конце. Отмечайте ✔ по мере выполнения.

---

## 🔴 A. GitHub: ветки и права (≈5 минут)

1. Откройте https://github.com/Readberg/da_zby → вкладка **Branches** (или Code → ветки).
2. Убедитесь, что есть `main`; ветку `dev` Claude создаст сам. Если репозиторий пустой — Claude сделает первый коммит.
3. Защита `main`: **Settings → Branches → Add branch ruleset** (или Add classic branch protection rule) → имя `main` → включите **Require a pull request before merging** с **0 обязательных ревью** (вы работаете один) и **Block force pushes**. Остальное не включайте — Claude должен мочь мержить.
4. Если Claude работает на вашем компьютере: в терминале `gh auth login` → GitHub.com → HTTPS → войти через браузер. Проверка: `gh auth status` показывает «Logged in».
5. Если Claude работает в облаке: в интерфейсе подключите репозиторий к сессии (с правом записи/push).

Проверка: Claude после старта сообщит «push в dev работает».

## 🔴 B. Jira: доступ Claude (≈10 минут)

**Способ 1 (рекомендуется, без токенов): Atlassian MCP.**
1. Если Claude работает в Claude Code: откройте сессию → команда `/mcp` → в списке найдите Atlassian → **Authenticate** → откроется браузер → войдите в аккаунт Atlassian → **Accept/Разрешить** для сайта `fmlight.atlassian.net`.
2. Если Atlassian в списке нет: добавьте сервер командой `claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse` (актуальный адрес и способ сверьте в документации «Atlassian Rovo MCP Server»), затем повторите п.1.
3. В приложении Claude (веб/десктоп) то же через Settings → Connectors → Atlassian Rovo → Connect.

**Способ 2 (запасной): API-токен.**
1. https://id.atlassian.com/manage-profile/security/api-tokens → **Create API token** → имя «da_zby» → срок 1 год → **Create** → **Copy**.
2. Откройте `.env.local` в корне проекта и впишите `JIRA_EMAIL=ваш_email` и `JIRA_API_TOKEN=скопированный_токен`.
3. Токен, который вы публиковали в чате при подготовке, **отзовите** на той же странице (Revoke) и используйте новый.

**Настройка проекта DAZBY** (Project settings в левом меню проекта; точные названия зависят от типа проекта):
1. **Issue types / Типы задач**: должны быть Эпик, Задача, Баг и **Анализ** (создайте «Анализ», если нет: Project settings → Issue types → Add issue type).
2. **Workflow / Рабочий процесс**: статусы «Бэклог», «К выполнению», «В работе», «Тестирование», «Готово». Добавьте недостающие и разрешите переходы между ними (можно «любой → любой»).
3. **Board / Доска → Board settings → Columns**: колонки «К выполнению», «В работе», «Тестирование», «Готово»; «Бэклог» — в отдельной колонке бэклога/вне доски.
4. **Swimlanes / Дорожки** (если доступны): три по JQL — `labels = frontend AND issuetype != Баг`, `labels = backend AND issuetype != Баг`, `issuetype = Баг`. Если ваш тип проекта дорожки по JQL не поддерживает — создайте **Quick filters** с теми же условиями.

Проверка: Claude после старта выведет «Jira: доступ есть, проект DAZBY найден, типы и статусы совпадают» либо перечислит, чего не хватает.

## 🔴 C. Supabase (dev-проект `ksykaqwkbfqtkvdxqedv`) (≈15 минут)

1. Войдите на https://supabase.com/dashboard → откройте проект (ссылка вида `…/project/lrybmorjxxbogbmmpddj`).
2. **Секретный ключ.** Левое меню **Project Settings → API Keys** → блок **Secret keys** (ключ вида `sb_secret_…`; в старом интерфейсе — `service_role` на вкладке Legacy API keys) → **Reveal / Create new secret key** → скопируйте. Впишите в `.env.local`: `SUPABASE_SECRET_KEY=…`. Этот ключ обходит все права — никому не показывайте и в браузерный код он не попадает.
3. **Автоприменение миграций (D-047, делается один раз ≈5 минут).** Дальше миграции применяет GitHub Actions при мерже в `dev` — SQL Editor не нужен.
   - **Токен доступа:** https://supabase.com/dashboard/account/tokens → **Generate new token** → имя «da_zby GitHub Actions» → скопируйте.
   - **Пароль БД:** проект → **Project Settings → Database → Database password** → если не помните — **Reset database password** → скопируйте новый.
   - **Положить в GitHub** (в терминале, значение вставляется в скрытый ввод и никуда больше не попадает):
     `gh secret set SUPABASE_ACCESS_TOKEN` → вставить токен → Enter;
     `gh secret set SUPABASE_DB_PASSWORD` → вставить пароль → Enter.
     (Или в браузере: репозиторий → **Settings → Secrets and variables → Actions → New repository secret**.)
   - Напишите Claude «секреты Supabase на месте» — он запустит workflow `db-migrate` и проверит схему сам.
4. **Проверка схемы:** **Table Editor** → видны таблицы `profiles`, `tournaments`, `seasons`, `clubs`, `season_clubs`, `tours`, `matches`, `predictions`, `season_standings`, `profile_private`, `admin_bootstrap`. **Storage** → бакеты `avatars` и `club-logos`.
5. **Провайдер Email оставьте включённым** (Authentication → Sign In / Providers): технически аккаунты Telegram-пользователей — это пользователи Supabase с синтетической почтой, письма им не отправляются.
6. **Адреса и письма** для входа настраивать не нужно (вход идёт через Telegram, D-054).

**Вы — первый админ:** укажите свой Telegram-id в переменной `TELEGRAM_ADMIN_IDS` (раздел E), при первом входе роль админа выдастся автоматически; ник выберете в онбординге.

## 🔴 D. Локальные файлы (≈3 минуты)

1. В корне проекта скопируйте `.env.example` → `.env.local` (Claude сделает это сам).
2. Заполните пустые значения: `SUPABASE_SECRET_KEY` (пункт C.2) и при способе 2 — `JIRA_*`. Остальное уже есть.
3. Файл `.env.local` не коммитится (он в `.gitignore`). Проверка: `git status` его не показывает.

## 🔴 E. Вход через Telegram (единственный способ входа, D-054, D-056) (≈10 минут)

1. В Telegram откройте **@BotFather** → `/newbot` → имя «Да забей вход» → username, оканчивающийся на `bot`. BotFather пришлёт **токен** вида `123456789:AA…` — это секрет: только в Railway Variables, в чат не присылайте. (Домен через `/setdomain` **не нужен**: вход идёт через бота.)
2. Свой числовой Telegram-id: напишите боту **@userinfobot** → «Id: 123456789». Это не секрет.
3. Railway → сервис → **Variables** → добавьте:
   - `TELEGRAM_BOT_TOKEN` = токен из шага 1;
   - `TELEGRAM_ADMIN_IDS` = ваш id из шага 2;
   - `SUPABASE_SECRET_KEY` = секретный ключ Supabase (C.2; только здесь и в `.env.local`).
4. Дождитесь деплоя: при старте сайт сам направит вебхук бота на свой адрес (в логах Railway: «[telegram] webhook registered» или «already set»). Миграция `login_tokens` применяется автоматически (workflow `db-migrate`).
5. Проверка: **Войти через Telegram** → открывается приложение Telegram → Start → выберите число с сайта → сайт сам входит и открывает профиль.

## 🔴 H. Перенос базы в Frankfurt (D-062, DAZBY-78) (≈15 минут вашего времени)

Зачем: сайт в Амстердаме, база в Токио — каждый запрос ≈0,35 с. Регион проекта менять нельзя, поэтому создаём новый проект рядом.
0. Если второй проект платный: старый (`lrybmorjxxbogbmmpddj`) можно удалить **после** того, как я скажу, что дамп каталога сделан (`pnpm db:copy-catalog dump`, папка `.catalog-dump/` не в Git). Пользователи и прогнозы со старого проекта пропадут (они тестовые).
1. https://supabase.com/dashboard → **New project** → организация та же → название `da-zby-dev-eu` → **Region: Central EU (Frankfurt)** → придумайте пароль БД (сохраните в менеджере паролей, в чат не присылайте) → **Create**.
2. Когда проект создан: **Project Settings → API Keys** — скопируйте адрес проекта (Project URL), publishable key (`sb_publishable_…`) и secret key (`sb_secret_…`).
3. Создайте файл `.env.new.local` в папке проекта (он в .gitignore) и впишите три строки: `NEXT_PUBLIC_SUPABASE_URL=…`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…`, `SUPABASE_SECRET_KEY=…`. В чат ключи не присылайте.
4. GitHub → репозиторий → Settings → Secrets and variables → Actions: обновите `SUPABASE_DB_PASSWORD` (пароль нового проекта). `SUPABASE_ACCESS_TOKEN` остаётся (он на аккаунт).
5. Напишите мне «проект готов, .env.new.local создан» и **ref нового проекта** (часть адреса до `.supabase.co`, он не секретный).
6. Дальше делаю я: применяю миграции на новый проект, восстанавливаю каталог из дампа (`pnpm db:copy-catalog restore`), меняю ref в workflow и env, обновляю переменные Railway через API (значения из файла, не из чата), проверяю вход и скорость. Telegram-вход после переезда заведёт новые аккаунты; админ — по `TELEGRAM_ADMIN_IDS`.
7. Если оставляете оба проекта (платно) — старый `lrybmorjxxbogbmmpddj` удалите сами, когда примете новый (Settings → General → Delete project).

## 🔴 I. Домен dazby.com (D-067, DAZBY-81)

Домен добавлен в Railway; чтобы он заработал, на стороне регистратора (или DNS-хостинга) нужны записи из Railway:
1. Railway → сервис `da_zby` → **Settings → Networking → Custom Domain `dazby.com`** — там показаны записи (обычно две: `CNAME` и `TXT` для проверки владельца). Скопируйте их значения **точно** (в чат присылать можно: это не секреты).
2. В панели DNS регистратора добавьте обе записи. Имя у корня домена — `@`. Частая проблема: многие регистраторы не принимают `CNAME` на корне домена; тогда нужен тип `ALIAS`/`ANAME` или перенос DNS в Cloudflare (бесплатно; там корневой CNAME работает как «flattening»).
3. Подождите (от минут до пары часов), в Railway статус станет «Verified», выпустится сертификат.
4. Напишите «DNS готов» — я сменю `NEXT_PUBLIC_SITE_URL` на `https://dazby.com`, проверю вход через Telegram, главную и `/auth/*` на новом адресе.
5. (По желанию) `www.dazby.com` → добавить вторым доменом в Railway и сделать перенаправление на корень.

## 🟡 F. Почта для писем входа (SMTP) (≈15 минут, когда начнёте тесты с другими людьми)

Выберите сервис (Resend, Brevo и т.п. — это ключевое решение, Claude заведёт задачу «Анализ» с вариантами). Далее: зарегистрируйтесь → создайте API-ключ/SMTP-доступ → Supabase → **Authentication → Emails → SMTP Settings** (в старом интерфейсе **Project Settings → Authentication → SMTP**) → **Enable custom SMTP** → вставьте хост, порт, логин, пароль, адрес отправителя → **Save**. Проверка: письмо входа приходит быстро и не в спам.

## 🟡 R. Тестовый стенд на Railway (DAZBY-42, ≈15 минут)

Сайт по публичному адресу, который сам обновляется после каждого мержа в `dev`. Сборка и запуск уже описаны в `railway.json` — в интерфейсе их задавать не нужно.

1. https://railway.com → **Login** → **Continue with GitHub** (тот же аккаунт Readberg).
2. Тариф: пробный период даёт стартовый кредит; для постоянной работы нужен платный план (на момент планирования Hobby ≈ $5/мес — актуальную цену проверьте на https://railway.com/pricing перед привязкой карты). Карту вводите сами.
3. **New Project → Deploy from GitHub repo** → если репозитория нет в списке: **Configure GitHub App** → доступ к `Readberg/da_zby` → **Save** → вернуться и выбрать `Readberg/da_zby`.
4. Откроется сервис. Сразу **Settings → Source → Branch** → выберите **`dev`** (это тестовый стенд; прод из `main` — позже, E8).
5. **Variables → Raw Editor** → вставьте (это публичные значения, не секреты) → **Update Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ksykaqwkbfqtkvdxqedv.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_GgweOwuWyidSPX_uWXpcvQ_uJgnxI0K
   YOUTUBE_CHANNEL_ID=UCsfcA6cY0bSL781TE3XMEPA
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
6. **Settings → Networking → Public Networking → Generate Domain** → скопируйте адрес вида `https://da-zby-production-xxxx.up.railway.app`.
7. `NEXT_PUBLIC_SITE_URL` менять не нужно: на Railway адрес сайта берётся из сгенерированного домена автоматически (DAZBY-42). Задайте его явно, только когда появится свой домен (схема `https://` добавится сама, если забыть).
8. **Deployments** → дождитесь статуса **Active** (зелёный). Откройте адрес — должна открыться главная.
9. Пришлите Claude адрес стенда (это не секрет) — он сам прогонит health и e2e по нему и закроет DAZBY-42.

## 🟢 G. В самом конце

- **Прод на Railway:** отдельный сервис/окружение из ветки `main` с прод-Supabase (E8).
- **Telegram-вход (эпик E7):** в Telegram откройте @BotFather → `/newbot` → имя и username → получите токен бота (секрет!) → `/setdomain` → укажите домен сайта. Домен нужен заранее, поэтому этап после покупки домена.
- **Прод-проект Supabase:** создать отдельный проект, применить те же миграции, заменить ключи и адреса.
- **Домен:** купить, привязать в Railway, повторить в @BotFather `/setdomain` с новым доменом.
- **Смена всех ключей:** заменить все ключи и токены, которые использовались при разработке (в т.ч. публиковавшиеся в чате).

---

## Если Claude работает в облачной песочнице

Сеть там ограничена (обычно реестры пакетов и GitHub). Поэтому Supabase CLI и прямые запросы к Supabase/YouTube из консоли песочницы могут не работать. Что это меняет:
- Схему применяйте через **SQL Editor** (пункт C.3, первый способ).
- Типы БД Claude сгенерирует из схемы вручную и пометит «обновить генерацией позже» — это нормально для первого запуска.
- Jira и GitHub идут через подключённые коннекторы, а не через токены в shell.
- Ручное тестирование вы проводите локально: `git pull` → `pnpm install` → `pnpm dev`.
