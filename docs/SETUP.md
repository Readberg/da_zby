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
3. **Применить схему БД** — один из способов:
   - **Через панель (проще, не нужен CLI):** левое меню **SQL Editor → New query** → откройте файл `supabase/migrations/20261024000000_init.sql`, вставьте весь текст → **Run** (должно быть «Success»). Затем **New query** → тот же шаг для `20261024000100_bootstrap_admin_and_kind.sql`.
   - **Через CLI (если Claude на вашем компьютере):** сначала `supabase login` (токен создаётся на https://supabase.com/dashboard/account/tokens → **Generate new token**); затем Claude выполнит `supabase link --project-ref lrybmorjxxbogbmmpddj`; пароль БД берётся в **Project Settings → Database → Database password** (если забыли — **Reset database password**, новый вставьте в терминал по запросу, в файлы не сохраняйте).
4. **Проверка схемы:** **Table Editor** → видны таблицы `profiles`, `tournaments`, `seasons`, `clubs`, `season_clubs`, `tours`, `matches`, `predictions`, `season_standings`, `profile_private`, `admin_bootstrap`. **Storage** → бакеты `avatars` и `club-logos`.
5. **Вход по email.** **Authentication → Sign In / Providers** (в старом интерфейсе **Providers**) → **Email** включён; **Confirm email** включён. Вход «по ссылке из письма» работает без дополнительных настроек.
6. **Адреса возврата.** **Authentication → URL Configuration**: **Site URL** = `http://localhost:3000`; **Redirect URLs** → **Add URL** → `http://localhost:3000/auth/callback` → **Save**. (Позже добавите адрес Railway и домен.)
7. **Письма.** Встроенная отправка Supabase имеет жёсткий лимит писем в час — для тестов хватит, для регулярной работы подключите свой SMTP (🟡 раздел F).

**Вы — первый админ автоматически:** когда вы впервые войдёте с почтой `wayreadberg@gmail.com` (через ссылку из письма или Google) и почта подтверждена, система сама выдаст роль админа и ник `Readberg`. Вручную ничего вводить не нужно.

## 🔴 D. Локальные файлы (≈3 минуты)

1. В корне проекта скопируйте `.env.example` → `.env.local` (Claude сделает это сам).
2. Заполните пустые значения: `SUPABASE_SECRET_KEY` (пункт C.2) и при способе 2 — `JIRA_*`. Остальное уже есть.
3. Файл `.env.local` не коммитится (он в `.gitignore`). Проверка: `git status` его не показывает.

## 🟡 E. Вход через Google (эпик E3) (≈20 минут)

1. https://console.cloud.google.com → сверху выпадающий список проектов → **New project** → имя «da-zby» → **Create**.
2. Меню **APIs & Services → OAuth consent screen** (или **Google Auth Platform**): нажмите **Get started** → App name «Да забей», User support email — ваш → Audience **External** → контактный email → **Create**.
3. Раздел **Audience / Publishing status**: пока приложение в режиме **Testing**, войти могут только добавленные **Test users** — добавьте `wayreadberg@gmail.com` и тестировщиков; перед публичным запуском нажмите **Publish app** (запрашиваются только базовые данные профиля — проверка Google не нужна).
4. **Clients → Create client** (или **Credentials → Create credentials → OAuth client ID**) → тип **Web application** → имя «da-zby web» → **Authorized redirect URIs → Add URI**: `https://lrybmorjxxbogbmmpddj.supabase.co/auth/v1/callback` → **Create**. Скопируйте **Client ID** и **Client secret**.
5. Supabase → **Authentication → Sign In / Providers → Google** → включите → вставьте Client ID и Client secret → **Save**.
6. Проверка: на странице входа кнопка «Войти через Google» ведёт на окно Google и возвращает на сайт.

## 🟡 F. Почта для писем входа (SMTP) (≈15 минут, когда начнёте тесты с другими людьми)

Выберите сервис (Resend, Brevo и т.п. — это ключевое решение, Claude заведёт задачу «Анализ» с вариантами). Далее: зарегистрируйтесь → создайте API-ключ/SMTP-доступ → Supabase → **Authentication → Emails → SMTP Settings** (в старом интерфейсе **Project Settings → Authentication → SMTP**) → **Enable custom SMTP** → вставьте хост, порт, логин, пароль, адрес отправителя → **Save**. Проверка: письмо входа приходит быстро и не в спам.

## 🟢 G. В самом конце

- **Railway:** https://railway.app → **New project → Deploy from GitHub repo** → `Readberg/da_zby` → ветка `main` → **Variables**: перенесите значения из `.env.local` (без `JIRA_*`) → **Deploy**. Временный адрес Railway добавьте в Supabase → URL Configuration (Redirect URLs).
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
