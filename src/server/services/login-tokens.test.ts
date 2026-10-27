// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  MAX_LIVE_TOKENS,
  TooManyLoginAttemptsError,
  botTexts,
  consumeLogin,
  handleBotUpdate,
  hashToken,
  loginStatus,
  startLogin,
} from "./login-tokens";
import type { TelegramBot } from "./telegram-bot";

type Row = Record<string, unknown> & { token_hash: string };

/** Minimal in-memory stand-in for the part of the Supabase query builder the service uses. */
function fakeAdmin(initial: Row[] = [], options: { liveCount?: number } = {}) {
  const rows: Row[] = [...initial];

  function builder(table: string) {
    if (table !== "login_tokens") throw new Error(`unexpected table ${table}`);
    const filters: ((row: Row) => boolean)[] = [];
    let mode: "select" | "update" | "delete" | "count" = "select";
    let patch: Record<string, unknown> = {};
    let max = Infinity;

    const matching = () => rows.filter((row) => filters.every((f) => f(row)));
    const run = () => {
      if (mode === "count") return { count: options.liveCount ?? matching().length, data: null };
      if (mode === "delete") {
        for (const row of matching()) rows.splice(rows.indexOf(row), 1);
        return { data: null, error: null };
      }
      const hit = matching().slice(0, max);
      if (mode === "update") for (const row of hit) Object.assign(row, patch);
      return { data: hit, error: null };
    };

    const api = {
      insert(row: Row) {
        rows.push({
          confirmed_at: null,
          consumed_at: null,
          telegram_id: null,
          telegram_username: null,
          first_name: null,
          last_name: null,
          ...row,
        });
        return Promise.resolve({ error: null });
      },
      select(_cols?: string, opts?: { count?: string }) {
        if (opts?.count) mode = "count";
        return api;
      },
      update(values: Record<string, unknown>) {
        mode = "update";
        patch = values;
        return api;
      },
      delete() {
        mode = "delete";
        return api;
      },
      eq: (col: string, value: unknown) => (filters.push((r) => r[col] === value), api),
      is: (col: string, value: unknown) => (filters.push((r) => (r[col] ?? null) === value), api),
      not: (col: string, _op: string, value: unknown) => (
        filters.push((r) => (r[col] ?? null) !== value),
        api
      ),
      gt: (col: string, value: string) => (filters.push((r) => String(r[col]) > value), api),
      lt: (col: string, value: string) => (filters.push((r) => String(r[col]) < value), api),
      like: (col: string, pattern: string) => (
        filters.push((r) => String(r[col]).startsWith(pattern.replace(/%$/, ""))),
        api
      ),
      limit: (n: number) => ((max = n), api),
      maybeSingle: () => {
        const result = run() as { data: Row[] };
        return Promise.resolve({ data: result.data[0] ?? null, error: null });
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve);
      },
    };
    return api;
  }

  return { admin: { from: builder } as never, rows };
}

function fakeBot() {
  const bot = {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    editMessage: vi.fn().mockResolvedValue(undefined),
    answerCallback: vi.fn().mockResolvedValue(undefined),
  } satisfies TelegramBot;
  return bot;
}

const NOW = new Date("2026-10-25T12:00:00.000Z");
const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

async function startedAttempt() {
  const fake = fakeAdmin();
  const attempt = await startLogin(fake.admin, NOW);
  return { ...fake, ...attempt };
}

describe("startLogin", () => {
  it("stores only the hash of the token, valid for ten minutes", async () => {
    const { rows, token, code, expiresInSeconds } = await startedAttempt();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(code).toMatch(/^[1-9]\d$/);
    expect(expiresInSeconds).toBe(600);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).toBe(hashToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]!.expires_at).toBe(later(600).toISOString());
  });

  it("refuses to start when too many attempts are in progress", async () => {
    const { admin } = fakeAdmin([], { liveCount: MAX_LIVE_TOKENS });
    await expect(startLogin(admin, NOW)).rejects.toBeInstanceOf(TooManyLoginAttemptsError);
  });

  it("cleans up attempts that ended long ago", async () => {
    const old: Row = { token_hash: "a".repeat(64), expires_at: later(-7200).toISOString() };
    const { admin, rows } = fakeAdmin([old]);
    await startLogin(admin, NOW);
    expect(rows.some((r) => r.token_hash === old.token_hash)).toBe(false);
  });
});

describe("the bot conversation", () => {
  it("offers three numbers including the right one when the visitor presses Start", async () => {
    const { admin, token, code } = await startedAttempt();
    const bot = fakeBot();
    await handleBotUpdate(
      admin,
      bot,
      { message: { chat: { id: 7 }, from: { id: 7 }, text: `/start ${token}` } },
      NOW,
    );

    expect(bot.sendMessage).toHaveBeenCalledOnce();
    const [chatId, text, buttons] = bot.sendMessage.mock.calls[0]!;
    expect(chatId).toBe(7);
    expect(text).toBe(botTexts.ru.choose);
    expect(buttons).toHaveLength(3);
    const list = buttons as { text: string; data: string }[];
    expect(new Set(list.map((b) => b.text)).size).toBe(3);
    expect(list.map((b) => b.text)).toContain(code);
    for (const b of list) expect(b.data).toMatch(/^c:[0-9a-f]{24}:\d{2}$/);
  });

  it("confirms the attempt for the Telegram user who picked the right number", async () => {
    const { admin, rows, token, code } = await startedAttempt();
    const bot = fakeBot();
    const prefix = hashToken(token).slice(0, 24);

    await handleBotUpdate(
      admin,
      bot,
      {
        callback_query: {
          id: "cb1",
          from: { id: 521054563, username: "roma", first_name: "Roma" },
          data: `c:${prefix}:${code}`,
          message: { message_id: 5, chat: { id: 7 } },
        },
      },
      NOW,
    );

    expect(rows[0]).toMatchObject({
      telegram_id: "521054563",
      telegram_username: "roma",
      first_name: "Roma",
    });
    expect(bot.answerCallback).toHaveBeenCalledWith("cb1", botTexts.ru.doneToast);
    expect(bot.editMessage).toHaveBeenCalledWith(7, 5, botTexts.ru.done);
    expect(await loginStatus(admin, token, NOW)).toBe("confirmed");
  });

  it("ends the attempt after one wrong number", async () => {
    const { admin, rows, token, code } = await startedAttempt();
    const bot = fakeBot();
    const wrong = code === "10" ? "11" : "10";

    await handleBotUpdate(
      admin,
      bot,
      {
        callback_query: {
          id: "cb2",
          from: { id: 9 },
          data: `c:${hashToken(token).slice(0, 24)}:${wrong}`,
          message: { message_id: 5, chat: { id: 7 } },
        },
      },
      NOW,
    );

    expect(rows[0]!.telegram_id).toBeNull();
    expect(bot.editMessage).toHaveBeenCalledWith(7, 5, botTexts.ru.wrong);
    expect(await loginStatus(admin, token, later(1))).toBe("expired");
  });

  it("tells about an unknown or expired link and ignores free text", async () => {
    const { admin } = fakeAdmin();
    const bot = fakeBot();
    await handleBotUpdate(
      admin,
      bot,
      { message: { chat: { id: 7 }, text: `/start ${"z".repeat(43)}` } },
      NOW,
    );
    expect(bot.sendMessage).toHaveBeenLastCalledWith(7, botTexts.ru.expired);

    await handleBotUpdate(admin, bot, { message: { chat: { id: 7 }, text: "привет" } }, NOW);
    expect(bot.sendMessage).toHaveBeenLastCalledWith(7, botTexts.ru.help);

    await handleBotUpdate(admin, bot, { message: { chat: { id: 7 }, text: "/start" } }, NOW);
    expect(bot.sendMessage).toHaveBeenLastCalledWith(7, botTexts.ru.help);
  });

  it("does not let a confirmed attempt be confirmed again by somebody else", async () => {
    const { admin, rows, token, code } = await startedAttempt();
    const bot = fakeBot();
    const data = `c:${hashToken(token).slice(0, 24)}:${code}`;
    const callback = (id: number, cb: string) => ({
      callback_query: { id: cb, from: { id }, data, message: { message_id: 1, chat: { id } } },
    });

    await handleBotUpdate(admin, bot, callback(1, "a"), NOW);
    await handleBotUpdate(admin, bot, callback(2, "b"), NOW);

    expect(rows[0]!.telegram_id).toBe("1");
    expect(bot.answerCallback).toHaveBeenLastCalledWith("b", botTexts.ru.staleToast);
  });

  it("ignores malformed callback data", async () => {
    const { admin, rows } = await startedAttempt();
    const bot = fakeBot();
    await handleBotUpdate(
      admin,
      bot,
      {
        callback_query: {
          id: "x",
          from: { id: 1 },
          data: "c:%:47",
          message: { message_id: 1, chat: { id: 1 } },
        },
      },
      NOW,
    );
    expect(rows[0]!.telegram_id).toBeNull();
    expect(bot.answerCallback).not.toHaveBeenCalled();
  });
});

describe("loginStatus and consumeLogin", () => {
  async function confirmed() {
    const state = await startedAttempt();
    state.rows[0]!.telegram_id = "42";
    state.rows[0]!.telegram_username = "roma";
    return state;
  }

  it("is pending until confirmed, then confirmed, and expired when unknown or late", async () => {
    const { admin, token } = await startedAttempt();
    expect(await loginStatus(admin, token, NOW)).toBe("pending");
    expect(await loginStatus(admin, token, later(601))).toBe("expired");
    expect(await loginStatus(admin, "unknown".repeat(5), NOW)).toBe("expired");
  });

  it("exchanges a confirmed token for the Telegram user exactly once", async () => {
    const { admin, token } = await confirmed();
    expect(await consumeLogin(admin, token, NOW)).toEqual({
      id: "42",
      username: "roma",
      firstName: null,
      lastName: null,
    });
    expect(await consumeLogin(admin, token, NOW)).toBeNull();
    expect(await loginStatus(admin, token, NOW)).toBe("expired");
  });

  it("refuses an unconfirmed or expired token", async () => {
    const pending = await startedAttempt();
    expect(await consumeLogin(pending.admin, pending.token, NOW)).toBeNull();

    const late = await confirmed();
    expect(await consumeLogin(late.admin, late.token, later(601))).toBeNull();
  });
});

describe("the bot speaks the language of the site (DAZBY-116)", () => {
  async function english() {
    const fake = fakeAdmin();
    const attempt = await startLogin(fake.admin, NOW, "en");
    return { ...fake, ...attempt };
  }

  it("remembers the site language of the attempt, Russian by default", async () => {
    expect((await english()).rows[0]!.locale).toBe("en");
    expect((await startedAttempt()).rows[0]!.locale).toBe("ru");
  });

  it("asks in English for an English attempt, whatever Telegram is set to", async () => {
    const { admin, token } = await english();
    const bot = fakeBot();
    await handleBotUpdate(
      admin,
      bot,
      {
        message: {
          chat: { id: 7 },
          from: { id: 7, language_code: "ru" },
          text: `/start ${token}`,
        },
      },
      NOW,
    );
    expect(bot.sendMessage.mock.calls[0]![1]).toBe(botTexts.en.choose);
  });

  it("confirms and cancels in English", async () => {
    const { admin, token, code } = await english();
    const bot = fakeBot();
    const prefix = hashToken(token).slice(0, 24);
    const callback = (data: string) => ({
      callback_query: {
        id: "cb",
        from: { id: 1 },
        data,
        message: { message_id: 5, chat: { id: 7 } },
      },
    });

    const wrong = code === "10" ? "11" : "10";
    await handleBotUpdate(admin, bot, callback(`c:${prefix}:${wrong}`), NOW);
    expect(bot.editMessage).toHaveBeenLastCalledWith(7, 5, botTexts.en.wrong);

    const second = await english();
    const secondPrefix = hashToken(second.token).slice(0, 24);
    await handleBotUpdate(second.admin, bot, callback(`c:${secondPrefix}:${second.code}`), NOW);
    expect(bot.answerCallback).toHaveBeenLastCalledWith("cb", botTexts.en.doneToast);
    expect(bot.editMessage).toHaveBeenLastCalledWith(7, 5, botTexts.en.done);
  });

  it("without a live attempt it follows Telegram's own language", async () => {
    const { admin } = fakeAdmin();
    const bot = fakeBot();
    const say = (language_code?: string) =>
      handleBotUpdate(
        admin,
        bot,
        { message: { chat: { id: 7 }, from: { id: 7, language_code }, text: "hi" } },
        NOW,
      );

    await say("en-GB");
    expect(bot.sendMessage).toHaveBeenLastCalledWith(7, botTexts.en.help);
    await say("be");
    expect(bot.sendMessage).toHaveBeenLastCalledWith(7, botTexts.ru.help);
    await say(undefined);
    expect(bot.sendMessage).toHaveBeenLastCalledWith(7, botTexts.ru.help);
  });
});
