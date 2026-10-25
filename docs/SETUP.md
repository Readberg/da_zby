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

## 🔴 C. Supabase (dev-проект `lrybmorjxxbogbmmpddj`) (≈15 минут)

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
5. **Вход по email.** **Authentication → Sign In / Providers** (в старом интерфейсе **Providers**) → **Email** включён; **Confirm email** включён. Вход «по ссылке из письма» работает без дополнительных настроек.
6. **Адреса возврата.** **Authentication → URL Configuration**: **Site URL** = `http://localhost:3000`; **Redirect URLs** → **Add URL** → `http://localhost:3000/auth/callback` → **Save**. (Позже добавите адрес Railway и домен.)
7. **Письма.** Встроенная отправка Supabase имеет жёсткий лимит писем в час — для тестов хватит, для регулярной работы подключите свой SMTP (🟡 раздел F).

**Вы — первый админ автоматически:** когда вы впервые войдёте с почтой `wayreadberg@gmail.com` (через ссылку из письма или Google) и почта подтверждена, система сама выдаст роль админа и ник `Readberg`. Вручную ничего вводить не нужно.

## 🔴 D. Локальные файлы (≈3 минуты)

1. В корне проекта скопируйте `.env.example` → `.env.local` (Claude сделает это сам).
2. Заполните пустые значения: `SUPABASE_SECRET_KEY` (пункт C.2) и при способе 2 — `JIRA_*`. Остальное уже есть.
3. Файл `.env.local` не коммитится (он в `.gitignore`). Проверка: `git status` его не показывает.

## 🔴 E. Вход через Google (основной способ входа, D-053) (≈20 минут)

1. https://console.cloud.google.com → сверху выпадающий список проектов → **New project** → имя «da-zby» → **Create**.
2. Меню **APIs & Services → OAuth consent screen** (или **Google Auth Platform**): нажмите **Get started** → App name «Да забей», User support email — ваш → Audience **External** → контактный email → **Create**.
3. Раздел **Audience / Publishing status**: пока приложение в режиме **Testing**, войти могут только добавленные **Test users** — добавьте `wayreadberg@gmail.com` и тестировщиков; перед публичным запуском нажмите **Publish app** (запрашиваются только базовые данные профиля — проверка Google не нужна).
4. **Clients → Create client** (или **Credentials → Create credentials → OAuth client ID**) → тип **Web application** → имя «da-zby web» → **Authorized redirect URIs → Add URI**: `https://lrybmorjxxbogbmmpddj.supabase.co/auth/v1/callback` → **Create**. Скопируйте **Client ID** и **Client secret**.
5. Supabase → **Authentication → Sign In / Providers → Google** → включите → вставьте Client ID и Client secret → **Save**.
6. Включите кнопку: в Railway → Variables добавьте `NEXT_PUBLIC_GOOGLE_AUTH=1` (и в `.env.local` для локальной проверки), дождитесь деплоя. Без флага кнопка скрыта.
7. Проверка: на странице входа кнопка «Войти через Google» ведёт на окно Google и возвращает на сайт.

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
   NEXT_PUBLIC_SUPABASE_URL=https://lrybmorjxxbogbmmpddj.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_GgweOwuWyidSPX_uWXpcvQ_uJgnxI0K
   YOUTUBE_CHANNEL_ID=UCsfcA6cY0bSL781TE3XMEPA
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
6. **Settings → Networking → Public Networking → Generate Domain** → скопируйте адрес вида `https://da-zby-production-xxxx.up.railway.app`.
7. `NEXT_PUBLIC_SITE_URL` менять не нужно: на Railway адрес сайта берётся из сгенерированного домена автоматически (DAZBY-42). Задайте его явно, только когда появится свой домен (схема `https://` добавится сама, если забыть).
8. **Deployments** → дождитесь статуса **Active** (зелёный). Откройте адрес — должна открыться главная.
9. Supabase → **Authentication → URL Configuration → Redirect URLs → Add URL** → `<адрес>/auth/callback` → **Save** (понадобится для входа в E3).
10. Пришлите Claude адрес стенда (это не секрет) — он сам прогонит health и e2e по нему и закроет DAZBY-42.

## 🟢 G. В самом конце

- **Прод на Railway:** отдельный сервис/окружение из ветки `main` с прод-Supabase (E8).
- **Telegram-вход (эпик E7):** в Telegram откройте @BotFather → `/newbot` → имя и username → получите токен бота (секрет!) → `/setdomain` → укажите домен сайта. Домен нужен заранее, поэтому этап после покупки домена.
- **Прод-проект Supabase:** создать отдельный проект, применить те же миграции, заменить ключи и адреса.
- **Домен:** купить, привязать в Railway, добавить в Supabase и Google (Authorized domains/Redirect URIs).
- **Смена всех ключей:** заменить все ключи и токены, которые использовались при разработке (в т.ч. публиковавшиеся в чате).

---

## Если Claude работает в облачной песочнице

Сеть там ограничена (обычно реестры пакетов и GitHub). Поэтому Supabase CLI и прямые запросы к Supabase/YouTube из консоли песочницы могут не работать. Что это меняет:
- Схему применяйте через **SQL Editor** (пункт C.3, первый способ).
- Типы БД Claude сгенерирует из схемы вручную и пометит «обновить генерацией позже» — это нормально для первого запуска.
- Jira и GitHub идут через подключённые коннекторы, а не через токены в shell.
- Ручное тестирование вы проводите локально: `git pull` → `pnpm install` → `pnpm dev`.
