import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.telegram.org";

/** The few Bot API calls the sign-in flow needs; injectable so the flow can be tested. */
export type TelegramBot = {
  sendMessage: (chatId: number, text: string, buttons?: ChoiceButton[]) => Promise<void>;
  editMessage: (chatId: number, messageId: number, text: string) => Promise<void>;
  answerCallback: (callbackId: string, text: string) => Promise<void>;
};

export type ChoiceButton = { text: string; data: string };

async function call<T>(botToken: string, method: string, body?: object): Promise<T> {
  const response = await fetch(`${API}/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  const json = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok)
    throw new Error(`Telegram ${method} failed: ${json.description ?? response.status}`);
  return json.result as T;
}

export function createTelegramBot(botToken: string): TelegramBot {
  return {
    async sendMessage(chatId, text, buttons) {
      await call(botToken, "sendMessage", {
        chat_id: chatId,
        text,
        ...(buttons
          ? {
              reply_markup: {
                inline_keyboard: [buttons.map((b) => ({ text: b.text, callback_data: b.data }))],
              },
            }
          : {}),
      });
    },
    async editMessage(chatId, messageId, text) {
      await call(botToken, "editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: { inline_keyboard: [] },
      });
    },
    async answerCallback(callbackId, text) {
      await call(botToken, "answerCallbackQuery", { callback_query_id: callbackId, text });
    },
  };
}

let cachedUsername: { token: string; username: string } | null = null;

/** Public username of the bot (for the t.me link); asked from Telegram once per process. */
export async function getBotUsername(botToken: string): Promise<string> {
  if (cachedUsername?.token === botToken) return cachedUsername.username;
  const me = await call<{ username: string }>(botToken, "getMe");
  cachedUsername = { token: botToken, username: me.username };
  return me.username;
}

/** Secret that Telegram echoes in a header of every webhook request; derived, so no extra setting. */
export function webhookSecret(botToken: string): string {
  return createHmac("sha256", botToken).update("dazby-telegram-webhook").digest("hex");
}

export function isValidWebhookSecret(botToken: string, given: string | null): boolean {
  if (!given) return false;
  const expected = Buffer.from(webhookSecret(botToken));
  const actual = Buffer.from(given);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type WebhookInfo = {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
};

/** The webhook as Telegram sees it: where it points and whether deliveries are failing. */
export function getWebhookInfo(botToken: string): Promise<WebhookInfo> {
  return call<WebhookInfo>(botToken, "getWebhookInfo");
}

/** Points the bot's webhook to this site (idempotent: does nothing when it already points here). */
export async function ensureWebhook(botToken: string, siteUrl: string): Promise<"set" | "ok"> {
  const url = `${siteUrl.replace(/\/+$/, "")}/api/telegram/webhook`;
  const info = await call<{ url: string }>(botToken, "getWebhookInfo");
  if (info.url === url) return "ok";
  await call(botToken, "setWebhook", {
    url,
    secret_token: webhookSecret(botToken),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  return "set";
}
