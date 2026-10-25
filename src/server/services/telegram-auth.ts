import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** How long a Telegram confirmation stays valid; the widget redirects right after the tap. */
export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 60 * 60;

export type TelegramUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type TelegramVerification =
  { ok: true; user: TelegramUser } | { ok: false; reason: "missing" | "signature" | "expired" };

/**
 * Checks the data Telegram Login Widget sends to the redirect URL
 * (https://core.telegram.org/widgets/login#checking-authorization): HMAC-SHA256 over the sorted
 * `key=value` lines, keyed with SHA256 of the bot token.
 */
export function verifyTelegramAuth(
  params: URLSearchParams,
  botToken: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): TelegramVerification {
  const hash = params.get("hash");
  const id = params.get("id");
  const authDate = Number(params.get("auth_date"));
  if (!hash || !id || !/^\d{1,20}$/.test(id) || !Number.isFinite(authDate)) {
    return { ok: false, reason: "missing" };
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();

  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "signature" };
  }
  if (nowSeconds - authDate > TELEGRAM_AUTH_MAX_AGE_SECONDS || authDate - nowSeconds > 300) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    user: {
      id,
      username: params.get("username"),
      firstName: params.get("first_name"),
      lastName: params.get("last_name"),
    },
  };
}
