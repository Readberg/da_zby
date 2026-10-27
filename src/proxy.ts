import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/i18n/config";
import { routeRequest } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const routing = routeRequest(request.nextUrl.pathname, request.cookies.get(LOCALE_COOKIE)?.value);

  if (routing.kind === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = routing.path;
    return NextResponse.redirect(url, 308);
  }
  if (routing.kind === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = routing.path;
    return updateSession(request, url);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
