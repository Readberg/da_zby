import type { ActionKey, Role } from "./permissions";

/** One descriptor per entity drives the list, the card, the form and the API (docs/ADMIN.md). */
export type FieldType = "text" | "number" | "bool" | "enum" | "datetime" | "uuid";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
  /** Shown as a column of the list. */
  list?: boolean;
  /** Part of the text search. */
  search?: boolean;
  sortable?: boolean;
  /** A filter on the list (enum / bool fields). */
  filter?: boolean;
  /** Who may edit the field; must match public.admin_edit_rules (checked by a test). */
  editMin?: Extract<Role, "moderator" | "admin">;
};

export type Entity = {
  key: string;
  label: string;
  table: string;
  idColumn: string;
  /** Without a single key column (no card). */
  noCard?: boolean;
  /** Only rows where this column is not null. */
  baseNotNull?: string;
  sort: { column: string; asc: boolean };
  fields: Field[];
  actions: ActionKey[];
};

const f = (
  name: string,
  label: string,
  type: FieldType = "text",
  extra: Partial<Field> = {},
): Field => ({ name, label, type, ...extra });

export const ENTITIES: Entity[] = [
  {
    key: "profiles",
    label: "Профили",
    table: "profiles",
    idColumn: "id",
    sort: { column: "created_at", asc: false },
    actions: ["set_role", "delete_profile"],
    fields: [
      f("id", "ID", "uuid"),
      f("nickname", "Ник", "text", {
        list: true,
        search: true,
        sortable: true,
        editMin: "moderator",
      }),
      f("full_name", "Имя", "text", { list: true, search: true, editMin: "moderator" }),
      f("role", "Роль", "enum", {
        list: true,
        filter: true,
        options: ["user", "moderator", "admin"],
      }),
      f("contact", "Контакт", "text", { search: true, editMin: "moderator" }),
      f("about", "О себе", "text", { editMin: "moderator" }),
      f("avatar_path", "Фото", "text", { editMin: "moderator" }),
      f("country_code", "Страна", "text", { editMin: "admin" }),
      f("city", "Город", "text", { editMin: "admin" }),
      f("utc_offset_minutes", "Пояс (мин)", "number", { editMin: "admin" }),
      f("created_at", "Создан", "datetime", { list: true, sortable: true }),
      f("last_login_at", "Вход", "datetime", { list: true, sortable: true }),
    ],
  },
  {
    key: "clubs",
    label: "Клубы менеджера",
    table: "mgr_clubs",
    idColumn: "id",
    sort: { column: "created_at", asc: false },
    actions: [
      "freeze_market",
      "unfreeze_market",
      "remove_logo",
      "adjust_budget",
      "make_bot",
      "reactivate_club",
    ],
    fields: [
      f("id", "ID", "uuid"),
      f("name", "Название", "text", {
        list: true,
        search: true,
        sortable: true,
        editMin: "moderator",
      }),
      f("user_id", "Профиль", "uuid", { list: true }),
      f("is_bot", "Бот", "bool", { list: true, filter: true }),
      f("market_frozen", "Торги заморожены", "bool", { list: true, filter: true }),
      f("market_frozen_reason", "Причина заморозки", "text"),
      f("budget", "Бюджет", "number", { list: true, sortable: true }),
      f("league_id", "Лига", "uuid"),
      f("logo_path", "Логотип", "text", { editMin: "moderator" }),
      f("primary_color", "Цвет 1", "text", { editMin: "admin" }),
      f("secondary_color", "Цвет 2", "text", { editMin: "admin" }),
      f("created_at", "Создан", "datetime", { list: true, sortable: true }),
    ],
  },
  {
    key: "players",
    label: "Игроки",
    table: "mgr_players",
    idColumn: "id",
    sort: { column: "created_at", asc: false },
    actions: [],
    fields: [
      f("id", "ID", "uuid"),
      f("first_name", "Имя", "text", { list: true, search: true, editMin: "moderator" }),
      f("last_name", "Фамилия", "text", {
        list: true,
        search: true,
        sortable: true,
        editMin: "moderator",
      }),
      f("position", "Позиция", "enum", {
        list: true,
        filter: true,
        options: ["GK", "DEF", "MID", "FWD"],
      }),
      f("age", "Возраст", "number", { list: true, sortable: true, editMin: "admin" }),
      f("ovr", "OVR", "number", { list: true, sortable: true }),
      f("form", "Форма", "number", { editMin: "admin" }),
      f("fitness", "Свежесть", "number", { editMin: "admin" }),
      f("morale", "Мораль", "number", { editMin: "admin" }),
      f("club_id", "Клуб", "uuid", { list: true }),
      f("created_at", "Создан", "datetime", { sortable: true }),
    ],
  },
  {
    key: "contracts",
    label: "Контракты",
    table: "mgr_players",
    idColumn: "id",
    baseNotNull: "contract_until",
    sort: { column: "contract_until", asc: true },
    actions: [],
    fields: [
      f("id", "Игрок (ID)", "uuid"),
      f("last_name", "Фамилия", "text", { list: true, search: true }),
      f("club_id", "Клуб", "uuid", { list: true }),
      f("wage", "Зарплата за тур", "number", { list: true, sortable: true }),
      f("contract_until", "До сезона", "number", { list: true, sortable: true }),
      f("tradable_after", "Можно продать с", "datetime", { list: true }),
    ],
  },
  {
    key: "leagues",
    label: "Лиги и сезоны",
    table: "mgr_leagues",
    idColumn: "id",
    sort: { column: "number", asc: false },
    actions: ["play_rounds"],
    fields: [
      f("id", "ID", "uuid"),
      f("number", "№", "number", { list: true, sortable: true }),
      f("season", "Сезон", "number", { list: true, sortable: true }),
      f("first_kickoff_at", "Старт 1 тура", "datetime", { list: true, sortable: true }),
      f("created_at", "Создана", "datetime", { list: true }),
    ],
  },
  {
    key: "matches",
    label: "Матчи менеджера",
    table: "mgr_matches",
    idColumn: "id",
    sort: { column: "kickoff_at", asc: false },
    actions: [],
    fields: [
      f("id", "ID", "uuid"),
      f("league_id", "Лига", "uuid", { list: true }),
      f("round", "Тур", "number", { list: true, sortable: true }),
      f("home_club_id", "Дома", "uuid", { list: true }),
      f("away_club_id", "В гостях", "uuid", { list: true }),
      f("status", "Статус", "enum", {
        list: true,
        filter: true,
        options: ["scheduled", "finished"],
      }),
      f("home_goals", "Голы дома", "number", { list: true }),
      f("away_goals", "Голы гостей", "number", { list: true }),
      f("kickoff_at", "Начало", "datetime", { list: true, sortable: true }),
    ],
  },
  {
    key: "auctions",
    label: "Лоты",
    table: "mgr_auctions",
    idColumn: "id",
    sort: { column: "created_at", asc: false },
    actions: [],
    fields: [
      f("id", "ID", "uuid"),
      f("player_id", "Игрок", "uuid", { list: true }),
      f("seller_club_id", "Продавец", "uuid", { list: true }),
      f("status", "Статус", "enum", {
        list: true,
        filter: true,
        options: ["open", "sold", "unsold", "cancelled"],
      }),
      f("start_price", "Старт", "number", { list: true, sortable: true }),
      f("best_bid", "Лучшая ставка", "number", { list: true, sortable: true }),
      f("final_price", "Итог", "number", { list: true, sortable: true }),
      f("buyer_club_id", "Покупатель", "uuid", { list: true }),
      f("created_at", "Создан", "datetime", { list: true, sortable: true }),
      f("ends_at", "Конец", "datetime", { sortable: true }),
    ],
  },
  {
    key: "bids",
    label: "Ставки",
    table: "mgr_bids",
    idColumn: "id",
    sort: { column: "created_at", asc: false },
    actions: [],
    fields: [
      f("id", "ID", "number"),
      f("auction_id", "Лот", "uuid", { list: true }),
      f("club_id", "Клуб", "uuid", { list: true }),
      f("amount", "Сумма", "number", { list: true, sortable: true }),
      f("status", "Статус", "enum", {
        list: true,
        filter: true,
        options: ["active", "won", "lost", "struck"],
      }),
      f("created_at", "Время", "datetime", { list: true, sortable: true }),
    ],
  },
  {
    key: "trades",
    label: "Предложения обмена",
    table: "mgr_trades",
    idColumn: "id",
    sort: { column: "created_at", asc: false },
    actions: [],
    fields: [
      f("id", "ID", "uuid"),
      f("from_club_id", "От", "uuid", { list: true }),
      f("to_club_id", "Кому", "uuid", { list: true }),
      f("cash", "Доплата", "number", { list: true, sortable: true }),
      f("status", "Статус", "enum", {
        list: true,
        filter: true,
        options: ["pending", "accepted", "declined", "cancelled", "expired"],
      }),
      f("created_at", "Создано", "datetime", { list: true, sortable: true }),
      f("resolved_at", "Закрыто", "datetime"),
    ],
  },
  {
    key: "transactions",
    label: "Журнал денег клуба",
    table: "mgr_transactions",
    idColumn: "id",
    sort: { column: "id", asc: false },
    actions: [],
    fields: [
      f("id", "№", "number", { list: true, sortable: true }),
      f("club_id", "Клуб", "uuid", { list: true }),
      f("amount", "Сумма", "number", { list: true, sortable: true }),
      f("reason", "Причина", "enum", {
        list: true,
        filter: true,
        options: [
          "base",
          "tickets",
          "premium",
          "wages",
          "prize",
          "purchase",
          "sale",
          "tax",
          "trade",
          "penalty",
          "admin",
        ],
      }),
      f("balance_after", "Баланс после", "number", { list: true }),
      f("created_at", "Время", "datetime", { list: true, sortable: true }),
    ],
  },
  {
    key: "deals",
    label: "Сделки между клубами",
    table: "mgr_deals",
    idColumn: "club_a",
    noCard: true,
    sort: { column: "created_at", asc: false },
    actions: [],
    fields: [
      f("club_a", "Клуб A", "uuid", { list: true }),
      f("club_b", "Клуб B", "uuid", { list: true }),
      f("season", "Сезон", "number", { list: true, sortable: true }),
      f("kind", "Вид", "enum", { list: true, filter: true, options: ["auction", "trade"] }),
      f("created_at", "Время", "datetime", { list: true, sortable: true }),
    ],
  },
  {
    key: "audit",
    label: "Журнал изменений",
    table: "admin_audit",
    idColumn: "id",
    sort: { column: "id", asc: false },
    actions: [],
    fields: [
      f("id", "№", "number", { list: true, sortable: true }),
      f("created_at", "Время", "datetime", { list: true, sortable: true }),
      f("actor_id", "Кто", "uuid", { list: true }),
      f("actor_role", "Роль", "enum", {
        list: true,
        filter: true,
        options: ["moderator", "admin"],
      }),
      f("action", "Действие", "text", { list: true, search: true }),
      f("entity", "Сущность", "text", { list: true, search: true }),
      f("entity_id", "Объект", "text", { list: true, search: true }),
      f("before", "Было", "text"),
      f("after", "Стало", "text"),
      f("reason", "Причина", "text", { list: true, search: true }),
    ],
  },
];

export const entityByKey = (key: string): Entity | undefined => ENTITIES.find((e) => e.key === key);

/** Sections of the existing admin that keep their own pages (not rewritten, D-139). */
export const LEGACY_SECTIONS = [
  { href: "/admin/tournaments", label: "Турниры" },
  { href: "/admin/clubs", label: "Клубы турнира" },
  { href: "/admin/seasons", label: "Сезоны и матчи турнира" },
  { href: "/admin/users", label: "Пользователи (роли, профили)" },
] as const;
