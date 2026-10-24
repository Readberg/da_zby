import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Where to send a user who has just signed in: the requested page, unless the profile has no
 * nickname yet, then onboarding (which returns to the requested page afterwards).
 */
export async function destinationAfterLogin(
  supabase: SupabaseClient<Database>,
  next: string,
): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return next;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.nickname) return next;
  return next === "/onboarding" ? next : `/onboarding?next=${encodeURIComponent(next)}`;
}
