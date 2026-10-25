import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleBotUpdate, type BotUpdate } from "@/server/services/login-tokens";
import { createTelegramBot, isValidWebhookSecret } from "@/server/services/telegram-bot";

/**
 * Webhook of the login bot. Telegram sends the derived secret in a header; anything without it is
 * rejected. Telegram retries on errors, so a processing failure is logged and still answered 200.
 */
export async function POST(request: NextRequest) {
  const botToken = serverEnv.TELEGRAM_BOT_TOKEN;
  if (!botToken || !serverEnv.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (!isValidWebhookSecret(botToken, request.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const update = (await request.json()) as BotUpdate;
    await handleBotUpdate(createAdminClient(), createTelegramBot(botToken), update);
  } catch (error) {
    console.error("[telegram] webhook update failed", error);
  }
  return NextResponse.json({ ok: true });
}
