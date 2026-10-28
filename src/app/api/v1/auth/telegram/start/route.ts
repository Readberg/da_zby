import { serverEnv } from "@/lib/env.server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import { withApi } from "@/server/api/v1/with-api";
import { TooManyLoginAttemptsError, startLogin } from "@/server/services/login-tokens";
import { getBotUsername } from "@/server/services/telegram-bot";

export const POST = withApi(endpoints.telegramLoginStart, async ({ request }) => {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : DEFAULT_LOCALE;
  const botToken = serverEnv.TELEGRAM_BOT_TOKEN;
  if (!botToken || !serverEnv.SUPABASE_SECRET_KEY) {
    throw new ApiError(
      503,
      ERROR_CODES.loginUnavailable,
      "Service Unavailable",
      "Telegram sign-in is not configured.",
    );
  }

  // One client cannot use up the shared pool of live attempts (see MAX_LIVE_TOKENS).
  if (!allowRequest(`login-start:${clientIp(request.headers)}`, 10, 10 * 60_000)) {
    throw new ApiError(
      429,
      ERROR_CODES.tooManyRequests,
      "Too Many Requests",
      "Too many sign-in attempts from your address. Try again in a few minutes.",
    );
  }

  try {
    const [attempt, username] = await Promise.all([
      startLogin(createAdminClient(), new Date(), locale),
      getBotUsername(botToken),
    ]);
    return {
      data: {
        token: attempt.token,
        code: attempt.code,
        appUrl: `tg://resolve?domain=${username}&start=${attempt.token}`,
        webUrl: `https://t.me/${username}?start=${attempt.token}`,
        expiresInSeconds: attempt.expiresInSeconds,
      },
    };
  } catch (error) {
    if (error instanceof TooManyLoginAttemptsError) {
      throw new ApiError(
        429,
        ERROR_CODES.tooManyRequests,
        "Too Many Requests",
        "Too many sign-in attempts are in progress. Try again in a minute.",
      );
    }
    throw error;
  }
});
