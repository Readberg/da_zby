import { createHmac, timingSafeEqual } from "node:crypto";
import type { TelegramUser } from "./login-tokens";

/** A launch older than this is refused: the data of a Mini App is made once, when it opens. */
export const INIT_DATA_MAX_AGE_SECONDS = 3600;

/**
 * Checks the data that Telegram hands to a Mini App when it opens (`initData`) and returns the
 * Telegram user it vouches for, or null. The data is a query string signed with a key made from the
 * bot token (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * the `hash` field must equal the HMAC-SHA256 of the other fields, sorted and joined by newlines.
 * Nothing in it is trusted before the signature is right and the launch is recent.
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  nowMs: number = Date.now(),
): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  params.delete("hash");

  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isInteger(authDate) || authDate <= 0) return null;
  const ageSeconds = nowMs / 1000 - authDate;
  if (ageSeconds > INIT_DATA_MAX_AGE_SECONDS || ageSeconds < -60) return null;

  let user: unknown;
  try {
    user = JSON.parse(params.get("user") ?? "");
  } catch {
    return null;
  }
  if (!user || typeof user !== "object") return null;
  const { id, username, first_name, last_name } = user as Record<string, unknown>;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return null;
  return {
    id: String(id),
    username: typeof username === "string" ? username : null,
    firstName: typeof first_name === "string" ? first_name : null,
    lastName: typeof last_name === "string" ? last_name : null,
  };
}

/** Builds signed data the way Telegram does; for tests and for trying the flow without Telegram. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const checkString = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(checkString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
