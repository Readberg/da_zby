import { serverEnv } from "@/lib/env.server";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import { withApi } from "@/server/api/v1/with-api";
import { parseAdminIds, prepareTelegramSession } from "@/server/services/telegram-login";
import { verifyInitData } from "@/server/services/telegram-miniapp";

export const POST = withApi(endpoints.telegramMiniAppLogin, async ({ request, body, supabase }) => {
  const botToken = serverEnv.TELEGRAM_BOT_TOKEN;
  if (!botToken || !serverEnv.SUPABASE_SECRET_KEY) {
    throw new ApiError(
      503,
      ERROR_CODES.loginUnavailable,
      "Service Unavailable",
      "Telegram sign-in is not configured.",
    );
  }
  if (!allowRequest(`miniapp:${clientIp(request.headers)}`, 20, 10 * 60_000)) {
    throw new ApiError(
      429,
      ERROR_CODES.tooManyRequests,
      "Too Many Requests",
      "Too many sign-in attempts from your address. Try again in a few minutes.",
    );
  }

  const user = verifyInitData(body.initData, botToken);
  if (!user) {
    throw new ApiError(
      401,
      ERROR_CODES.authRequired,
      "Unauthorized",
      "The Telegram data is invalid or has expired. Close the app and open it again.",
    );
  }

  // The same path as the bot sign-in: the account of this Telegram id, a one-time token, a session.
  const tokenHash = await prepareTelegramSession(
    createAdminClient(),
    user,
    parseAdminIds(serverEnv.TELEGRAM_ADMIN_IDS),
  );
  const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (error) throw new Error(`Mini App sign-in failed: ${error.message}`);
  return { data: { signedIn: true as const } };
});
