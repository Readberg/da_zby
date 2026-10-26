import { errorFields, log } from "./lib/log";

/**
 * Next.js calls this for every error it catches in a page, a route handler or a server component.
 * One structured line per error with the route and the digest that the browser's error report
 * (Umami "client-error") carries too, so the two can be matched (D-079). No query strings, no bodies.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string },
) {
  log("error", "request.error", {
    method: request.method,
    path: request.path.split("?")[0],
    route: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    renderSource: context.renderSource,
    ...errorFields(error),
  });
}

// Runs once when the server starts: fail fast with a readable message on bad configuration and
// keep the login bot's webhook pointed at this site.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  await import("./lib/env");
  const { serverEnv } = await import("./lib/env.server");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const isLocal = !siteUrl || /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(siteUrl);
  if (process.env.NODE_ENV !== "production" || isLocal || !serverEnv.TELEGRAM_BOT_TOKEN) return;

  try {
    const { ensureWebhook } = await import("./server/services/telegram-bot");
    const result = await ensureWebhook(serverEnv.TELEGRAM_BOT_TOKEN, siteUrl);
    log("info", "telegram.webhook", { state: result === "set" ? "registered" : "already set" });
  } catch (error) {
    log("error", "telegram.webhook_register_failed", errorFields(error));
  }
}
