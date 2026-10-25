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
    console.log(`[telegram] webhook ${result === "set" ? "registered" : "already set"}`);
  } catch (error) {
    console.error("[telegram] could not register the webhook", error);
  }
}
