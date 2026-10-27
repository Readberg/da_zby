import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/** Supabase stores the session in cookies named `sb-<project-ref>-auth-token[.N]`. */
export function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}

/**
 * Refreshes the Supabase session cookie on every matched request (called from `src/proxy.ts`).
 * With `rewriteTo` the page is served from that internal address (the language segment, D-088);
 * the refreshed cookies travel with either kind of response.
 */
export async function updateSession(request: NextRequest, rewriteTo?: URL): Promise<NextResponse> {
  const respond = () =>
    rewriteTo ? NextResponse.rewrite(rewriteTo, { request }) : NextResponse.next({ request });
  let response = respond();

  // Guests have no session to refresh: skip the network round-trip to Supabase Auth.
  if (!hasAuthCookie(request)) {
    return response;
  }

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = respond();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Keep getUser() right after client creation: it validates and refreshes the token.
  await supabase.auth.getUser();

  return response;
}
