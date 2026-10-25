import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { LOGIN_NEXT_COOKIE } from "@/lib/login-next";
import { publicOrigin } from "@/lib/public-origin";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumeLogin } from "@/server/services/login-tokens";
import { destinationAfterLogin } from "@/server/services/post-login";
import { parseAdminIds, prepareTelegramSession } from "@/server/services/telegram-login";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

/**
 * Last step of signing in through the bot: exchanges the confirmed one-time token for a session.
 * Any failure returns to /login with a generic message.
 */
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const fail = () => NextResponse.redirect(new URL("/login?error=telegram", origin));

  const token = request.nextUrl.searchParams.get("token");
  if (!token || !TOKEN_PATTERN.test(token)) return fail();
  if (!serverEnv.TELEGRAM_BOT_TOKEN || !serverEnv.SUPABASE_SECRET_KEY) return fail();

  try {
    const admin = createAdminClient();
    const user = await consumeLogin(admin, token);
    if (!user) return fail();

    const tokenHash = await prepareTelegramSession(
      admin,
      user,
      parseAdminIds(serverEnv.TELEGRAM_ADMIN_IDS),
    );
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
    if (error) return fail();

    // Signing in from the header (no particular page asked for) lands on the profile.
    const requested = safeRedirectPath(request.cookies.get(LOGIN_NEXT_COOKIE)?.value ?? null);
    const next = requested === "/" ? "/profile" : requested;
    const response = NextResponse.redirect(
      new URL(await destinationAfterLogin(supabase, next), origin),
    );
    response.cookies.delete(LOGIN_NEXT_COOKIE);
    return response;
  } catch {
    return fail();
  }
}
