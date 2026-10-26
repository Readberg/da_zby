import { serverEnv } from "@/lib/env.server";
import { resolveSiteUrl } from "@/lib/site-url";
import { getWebhookInfo, type WebhookInfo } from "./telegram-bot";

export type WebhookState = "ok" | "error" | "skipped";

/** A delivery error older than this no longer counts (Telegram keeps the last error for a long time). */
const ERROR_WINDOW_SECONDS = 15 * 60;
const CACHE_MS = 60_000;

/**
 * The webhook is healthy when it points at this site and Telegram has not failed to deliver to it
 * recently. A webhook that points elsewhere (or at a domain that is not connected yet) silently
 * stops the Telegram sign-in: no code ever arrives.
 */
export function evaluateWebhook(
  info: Pick<WebhookInfo, "url" | "last_error_date">,
  expectedUrl: string,
  nowSeconds: number,
): WebhookState {
  if (info.url !== expectedUrl) return "error";
  if (info.last_error_date && nowSeconds - info.last_error_date < ERROR_WINDOW_SECONDS)
    return "error";
  return "ok";
}

let cached: { at: number; state: WebhookState } | null = null;

/** The state of this site's Telegram webhook; "skipped" when the bot is not configured here. */
export async function checkWebhook(
  now: () => number = Date.now,
  read: (token: string) => Promise<WebhookInfo> = getWebhookInfo,
): Promise<WebhookState> {
  const token = serverEnv.TELEGRAM_BOT_TOKEN;
  const site = resolveSiteUrl(process.env);
  const local = !site || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(site);
  if (!token || local) return "skipped";
  if (cached && now() - cached.at < CACHE_MS) return cached.state;

  let state: WebhookState;
  try {
    const info = await read(token);
    state = evaluateWebhook(info, `${site.replace(/\/+$/, "")}/api/telegram/webhook`, now() / 1000);
  } catch {
    state = "error";
  }
  cached = { at: now(), state };
  return state;
}

/** For tests. */
export function resetWebhookCache() {
  cached = null;
}
