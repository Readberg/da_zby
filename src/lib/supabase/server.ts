import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components and Route Handlers, acting as the current user
 * (publishable key + session cookie, RLS applies). Create one per request.
 * Check the user with `supabase.auth.getUser()`, never `getSession()`.
 * With `accessToken` (an external API client's `Authorization: Bearer`) the queries are made as that
 * user instead of the cookie session, so RLS sees the same person that `getUser(token)` verified.
 */
export async function createClient(accessToken?: string) {
  // A session check reads the clock (token expiry). That is request-time work: say so, otherwise
  // Next.js reports an unstable value while prerendering for every signed-in page (DAZBY-129).
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      ...(accessToken
        ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
        : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies; the proxy refreshes the session instead.
          }
        },
      },
    },
  );
}
