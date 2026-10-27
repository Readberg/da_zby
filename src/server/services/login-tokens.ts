import { createHash, randomBytes, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import type { Database } from "@/types/database";
import type { TelegramBot } from "./telegram-bot";

export const LOGIN_TOKEN_TTL_SECONDS = 600;
/** Upper bound of unfinished sign-in attempts: keeps the public start endpoint from filling the table. */
export const MAX_LIVE_TOKENS = 1000;

const PREFIX_LENGTH = 24;

export type TelegramUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type LoginStatus = "pending" | "confirmed" | "expired";

export class TooManyLoginAttemptsError extends Error {
  constructor() {
    super("Too many sign-in attempts in progress");
    this.name = "TooManyLoginAttemptsError";
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type Admin = SupabaseClient<Database>;

/** Creates a sign-in attempt. The returned token goes to the browser and into the bot link only. */
export async function startLogin(
  admin: Admin,
  now: Date = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): Promise<{ token: string; code: string; expiresInSeconds: number }> {
  // Housekeeping: drop attempts that ended long ago.
  await admin
    .from("login_tokens")
    .delete()
    .lt("expires_at", new Date(now.getTime() - 3600_000).toISOString());

  const { count } = await admin
    .from("login_tokens")
    .select("token_hash", { count: "exact", head: true })
    .gt("expires_at", now.toISOString())
    .is("consumed_at", null);
  if ((count ?? 0) >= MAX_LIVE_TOKENS) throw new TooManyLoginAttemptsError();

  const token = randomBytes(32).toString("base64url");
  const code = String(randomInt(10, 100));
  const { error } = await admin.from("login_tokens").insert({
    token_hash: hashToken(token),
    code,
    locale,
    expires_at: new Date(now.getTime() + LOGIN_TOKEN_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw new Error(`login token insert failed: ${error.message}`);
  return { token, code, expiresInSeconds: LOGIN_TOKEN_TTL_SECONDS };
}

export async function loginStatus(
  admin: Admin,
  token: string,
  now: Date = new Date(),
): Promise<LoginStatus> {
  const { data } = await admin
    .from("login_tokens")
    .select("telegram_id, expires_at, consumed_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || data.consumed_at || new Date(data.expires_at) <= now) return "expired";
  return data.telegram_id ? "confirmed" : "pending";
}

/** Exchanges a confirmed token for the Telegram user, once. Returns null for anything else. */
export async function consumeLogin(
  admin: Admin,
  token: string,
  now: Date = new Date(),
): Promise<TelegramUser | null> {
  const { data } = await admin
    .from("login_tokens")
    .update({ consumed_at: now.toISOString() })
    .eq("token_hash", hashToken(token))
    .is("consumed_at", null)
    .not("telegram_id", "is", null)
    .gt("expires_at", now.toISOString())
    .select("telegram_id, telegram_username, first_name, last_name")
    .maybeSingle();
  if (!data?.telegram_id) return null;
  return {
    id: data.telegram_id,
    username: data.telegram_username,
    firstName: data.first_name,
    lastName: data.last_name,
  };
}

// --- Bot side -------------------------------------------------------------------------------

type TelegramFrom = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export type BotUpdate = {
  message?: { chat: { id: number }; from?: TelegramFrom; text?: string };
  callback_query?: {
    id: string;
    from: TelegramFrom;
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
};

const START_PATTERN = /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{20,64})$/;
const CALLBACK_PATTERN = /^c:([0-9a-f]{24}):(\d{2})$/;

type BotTexts = {
  help: string;
  expired: string;
  choose: string;
  done: string;
  wrong: string;
  wrongToast: string;
  doneToast: string;
  staleToast: string;
};

/** What the bot says, in the language the visitor uses on the site (D-088). */
export const botTexts: Record<Locale, BotTexts> = {
  ru: {
    help: "Это бот входа на сайт «Да забей». Нажмите «Войти через Telegram» на сайте — и вернитесь сюда.",
    expired:
      "Ссылка для входа устарела. Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.",
    choose:
      "Вход на сайт «Да забей». Выберите число, которое показано на сайте. Если вы не входили на сайт — просто проигнорируйте это сообщение.",
    done: "Готово, вы вошли на сайт. Вернитесь в браузер.",
    wrong: "Вход отменён: выбрано не то число. Начните заново на сайте.",
    wrongToast: "Неверное число. Вход отменён.",
    doneToast: "Готово!",
    staleToast: "Ссылка устарела.",
  },
  en: {
    help: "This is the sign-in bot of the Da Zabey site. Press “Sign in with Telegram” on the site and come back here.",
    expired:
      "The sign-in link has expired. Go back to the site and press “Sign in with Telegram” again.",
    choose:
      "Signing in to Da Zabey. Pick the number shown on the site. If you did not try to sign in, just ignore this message.",
    done: "Done, you are signed in. Return to the browser.",
    wrong: "Sign-in cancelled: wrong number. Start again on the site.",
    wrongToast: "Wrong number. Sign-in cancelled.",
    doneToast: "Done!",
    staleToast: "The link has expired.",
  },
};

/** Telegram's own language setting, used only when the site language is not known (no live attempt). */
export function localeFromTelegram(languageCode: string | undefined): Locale {
  if (!languageCode) return DEFAULT_LOCALE;
  return /^(ru|be|uk|kk)(-|$)/i.test(languageCode) ? "ru" : "en";
}

function isSiteLocale(value: unknown): value is Locale {
  return value === "ru" || value === "en";
}

function shuffled<T>(items: T[]): T[] {
  return items
    .map((item) => ({ item, key: randomInt(0, 1_000_000) }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

function choices(correct: string): string[] {
  const options = new Set([correct]);
  while (options.size < 3) options.add(String(randomInt(10, 100)));
  return shuffled([...options]);
}

async function findLive(admin: Admin, hashPrefix: string, now: Date) {
  const { data } = await admin
    .from("login_tokens")
    .select("token_hash, code, telegram_id, locale")
    .like("token_hash", `${hashPrefix}%`)
    .is("consumed_at", null)
    .gt("expires_at", now.toISOString())
    .limit(2);
  return data?.length === 1 ? data[0]! : null;
}

/** Handles one update from the bot webhook. Never throws for unexpected input. */
export async function handleBotUpdate(
  admin: Admin,
  bot: TelegramBot,
  update: BotUpdate,
  now: Date = new Date(),
): Promise<void> {
  const message = update.message;
  if (message?.text !== undefined) {
    const fallback = localeFromTelegram(message.from?.language_code);
    const token = START_PATTERN.exec(message.text.trim())?.[1];
    if (!token) {
      await bot.sendMessage(message.chat.id, botTexts[fallback].help);
      return;
    }
    const live = await findLive(admin, hashToken(token).slice(0, PREFIX_LENGTH), now);
    if (!live || live.telegram_id) {
      await bot.sendMessage(message.chat.id, botTexts[fallback].expired);
      return;
    }
    const texts = botTexts[isSiteLocale(live.locale) ? live.locale : fallback];
    const prefix = live.token_hash.slice(0, PREFIX_LENGTH);
    await bot.sendMessage(
      message.chat.id,
      texts.choose,
      choices(live.code).map((code) => ({ text: code, data: `c:${prefix}:${code}` })),
    );
    return;
  }

  const callback = update.callback_query;
  if (!callback) return;
  const match = CALLBACK_PATTERN.exec(callback.data ?? "");
  const chat = callback.message;
  if (!match || !chat) return;

  const [, prefix, picked] = match as unknown as [string, string, string];
  const live = await findLive(admin, prefix, now);
  const fallback = localeFromTelegram(callback.from.language_code);
  if (!live || live.telegram_id) {
    await bot.answerCallback(callback.id, botTexts[fallback].staleToast);
    await bot.editMessage(chat.chat.id, chat.message_id, botTexts[fallback].expired);
    return;
  }
  const texts = botTexts[isSiteLocale(live.locale) ? live.locale : fallback];

  if (picked !== live.code) {
    // One try only: a wrong number ends this attempt.
    await admin
      .from("login_tokens")
      .update({ expires_at: now.toISOString() })
      .eq("token_hash", live.token_hash);
    await bot.answerCallback(callback.id, texts.wrongToast);
    await bot.editMessage(chat.chat.id, chat.message_id, texts.wrong);
    return;
  }

  await admin
    .from("login_tokens")
    .update({
      telegram_id: String(callback.from.id),
      telegram_username: callback.from.username ?? null,
      first_name: callback.from.first_name ?? null,
      last_name: callback.from.last_name ?? null,
      confirmed_at: now.toISOString(),
    })
    .eq("token_hash", live.token_hash)
    .is("telegram_id", null);
  await bot.answerCallback(callback.id, texts.doneToast);
  await bot.editMessage(chat.chat.id, chat.message_id, texts.done);
}
