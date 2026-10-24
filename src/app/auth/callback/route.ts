import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { destinationAfterLogin } from "@/server/services/post-login";

/**
 * OAuth / magic-link (PKCE) callback: exchanges `code` for a session cookie.
 * Works only in the browser that requested the link; cross-browser links go through /auth/confirm.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(await destinationAfterLogin(supabase, next), origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
