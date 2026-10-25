import type { SupabaseClient } from "@supabase/supabase-js";
import { avatarUrl } from "@/lib/avatar";
import { NICKNAME_PATTERN, type ProfilePatch } from "@/lib/profile-schema";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type { ProfileMe } from "@/server/api/v1/schemas/profile";
import type { Database, Tables } from "@/types/database";

type Db = SupabaseClient<Database>;
type AuthUser = { id: string; email?: string | null };

// Postgres error codes we translate into API errors.
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

function toDto(row: Tables<"profiles">, email: string | null): ProfileMe {
  return {
    id: row.id,
    nickname: row.nickname,
    fullName: row.full_name,
    contact: row.contact,
    about: row.about,
    avatarUrl: avatarUrl(row.avatar_path),
    countryCode: row.country_code,
    city: row.city,
    utcOffsetMinutes: row.utc_offset_minutes,
    role: row.role === "admin" ? "admin" : "user",
    email,
    createdAt: new Date(row.created_at).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
  };
}

async function loadRow(supabase: Db, userId: string): Promise<Tables<"profiles">> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new ApiError(
      404,
      ERROR_CODES.profileNotFound,
      "Not Found",
      "Profile does not exist yet.",
    );
  }
  return data;
}

/** Time zone of a user as a fixed UTC offset in minutes; UTC+3 when there is no profile row. */
export async function getUtcOffsetMinutes(supabase: Db, userId: string): Promise<number> {
  const { data } = await supabase
    .from("profiles")
    .select("utc_offset_minutes")
    .eq("id", userId)
    .maybeSingle();
  return data?.utc_offset_minutes ?? 180;
}

export async function getOwnProfile(supabase: Db, user: AuthUser): Promise<ProfileMe> {
  return toDto(await loadRow(supabase, user.id), user.email ?? null);
}

/**
 * Applies a validated patch to the caller's own profile. RLS and column grants additionally
 * guarantee that nothing but the user's own, user-editable columns can change.
 */
export async function updateOwnProfile(
  supabase: Db,
  user: AuthUser,
  patch: ProfilePatch,
): Promise<ProfileMe> {
  const current = await loadRow(supabase, user.id);
  const update: Database["public"]["Tables"]["profiles"]["Update"] = {};

  if (patch.nickname !== undefined) {
    if (patch.nickname !== current.nickname) update.nickname = patch.nickname;
  }
  if (patch.fullName !== undefined) update.full_name = patch.fullName;
  if (patch.contact !== undefined) update.contact = patch.contact;
  if (patch.about !== undefined) update.about = patch.about;
  if (patch.countryCode !== undefined) update.country_code = patch.countryCode;
  if (patch.city !== undefined) update.city = patch.city;
  if (patch.avatarPath !== undefined) {
    // Storage RLS lets users write only into their own folder; refuse to point at anyone else's file.
    if (patch.avatarPath !== null && !patch.avatarPath.startsWith(`${user.id}/`)) {
      throw new ApiError(
        422,
        ERROR_CODES.validationFailed,
        "Unprocessable Content",
        "Photo path is not yours.",
        [{ field: "avatarPath", message: "Фото должно быть загружено вами" }],
      );
    }
    update.avatar_path = patch.avatarPath;
  }
  if (patch.utcOffsetMinutes !== undefined) update.utc_offset_minutes = patch.utcOffsetMinutes;

  if (Object.keys(update).length === 0) return toDto(current, user.email ?? null);

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new ApiError(
        409,
        ERROR_CODES.nicknameTaken,
        "Conflict",
        "This nickname is already taken.",
        [{ field: "nickname", message: "Этот ник уже занят" }],
      );
    }
    if (error.code === CHECK_VIOLATION) {
      throw new ApiError(422, ERROR_CODES.validationFailed, "Unprocessable Content", error.message);
    }
    throw error;
  }
  return toDto(data, user.email ?? null);
}

export async function checkNickname(
  supabase: Db,
  nickname: string,
): Promise<{ valid: boolean; available: boolean }> {
  if (!NICKNAME_PATTERN.test(nickname)) return { valid: false, available: false };

  // `nickname` is citext, so equality is case-insensitive.
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("nickname", nickname)
    .limit(1);
  if (error) throw error;
  return { valid: true, available: (data ?? []).length === 0 };
}
