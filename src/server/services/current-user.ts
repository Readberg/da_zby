import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  nickname: string | null;
  avatarPath: string | null;
  role: string;
};

/**
 * The signed-in user with the profile fields the layout needs, or null for guests.
 * Uses getUser() (validated against Supabase Auth), never getSession().
 * Cached per request: the header and the page share one lookup instead of two.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, avatar_path, role")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    nickname: profile?.nickname ?? null,
    avatarPath: profile?.avatar_path ?? null,
    role: profile?.role ?? "user",
  };
});

/** For pages that act in the user's name: signed in AND with a nickname (otherwise onboarding first). */
export async function requireProfile(
  returnTo: string,
): Promise<CurrentUser & { nickname: string }> {
  const user = await requireUser(returnTo);
  if (!user.nickname) redirect(`/onboarding?next=${encodeURIComponent(returnTo)}`);
  return { ...user, nickname: user.nickname };
}

/** For pages that need a signed-in user: guests are sent to /login and come back afterwards. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}
