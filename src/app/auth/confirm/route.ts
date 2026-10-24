import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { destinationAfterLogin } from "@/server/services/post-login";

const OTP_TYPES: readonly EmailOtpType[] = ["magiclink", "email", "signup", "recovery", "invite"];

/**
 * Magic-link confirmation by token hash (email template uses {{ .TokenHash }}).
 * Unlike the PKCE callback it does not depend on the browser that requested the link,
 * which matters when the link is opened from a mail app or an in-app browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(await destinationAfterLogin(supabase, next), origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
