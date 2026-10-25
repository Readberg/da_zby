import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { LOGIN_NEXT_COOKIE } from "@/lib/login-next";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { destinationAfterLogin } from "@/server/services/post-login";
import { verifyTelegramAuth } from "@/server/services/telegram-auth";
import { parseAdminIds, prepareTelegramSession } from "@/server/services/telegram-login";

/**
 * Redirect target of the Telegram Login Widget. Verifies Telegram's signature, finds or creates
 * the account and opens a session. Any failure returns to /login with a generic message.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const fail = () => NextResponse.redirect(new URL("/login?error=telegram", origin));

  const botToken = serverEnv.TELEGRAM_BOT_TOKEN;
  if (!botToken || !serverEnv.SUPABASE_SECRET_KEY) return fail();

  const verified = verifyTelegramAuth(searchParams, botToken);
  if (!verified.ok) return fail();

  try {
    const tokenHash = await prepareTelegramSession(
      createAdminClient(),
      verified.user,
      parseAdminIds(serverEnv.TELEGRAM_ADMIN_IDS),
    );
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
    if (error) return fail();

    const next = safeRedirectPath(request.cookies.get(LOGIN_NEXT_COOKIE)?.value ?? null);
    const response = NextResponse.redirect(
      new URL(await destinationAfterLogin(supabase, next), origin),
    );
    response.cookies.delete(LOGIN_NEXT_COOKIE);
    return response;
  } catch {
    return fail();
  }
}
