import type { SupabaseClient } from "@supabase/supabase-js";
import { avatarUrl } from "@/lib/avatar";
import type { Database } from "@/types/database";

export type PublicProfile = {
  nickname: string;
  fullName: string | null;
  contact: string | null;
  about: string | null;
  avatarUrl: string | null;
  countryCode: string | null;
  city: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

/**
 * Public view of a profile (PRODUCT §6): no e-mail, no time zone, no role.
 * Only these columns are selected, so nothing private can leak by adding a field to the row.
 */
export async function getPublicProfile(
  supabase: SupabaseClient<Database>,
  nickname: string,
): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "nickname, full_name, contact, about, avatar_path, country_code, city, created_at, last_login_at",
    )
    // citext column: equality ignores case.
    .eq("nickname", nickname)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.nickname) return null;

  return {
    nickname: data.nickname,
    fullName: data.full_name,
    contact: data.contact,
    about: data.about,
    avatarUrl: avatarUrl(data.avatar_path),
    countryCode: data.country_code,
    city: data.city,
    createdAt: new Date(data.created_at).toISOString(),
    lastLoginAt: data.last_login_at ? new Date(data.last_login_at).toISOString() : null,
  };
}
