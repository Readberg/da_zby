import type { SupabaseClient } from "@supabase/supabase-js";
import { avatarUrl } from "@/lib/avatar";
import { log } from "@/lib/log";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type {
  AdminUserProfile,
  AdminUserProfileBody,
  AdminUserRoleBody,
  AdminUsers,
} from "@/server/api/v1/schemas/admin";
import type { Database, Tables } from "@/types/database";
import { CHECK_VIOLATION, UNIQUE_VIOLATION } from "./pg-errors";

type Db = SupabaseClient<Database>;

/** Characters that would change the meaning of a PostgREST `or(...)` filter or an ILIKE pattern. */
function sanitizeSearch(search: string): string {
  return search
    .replace(/[%_*,()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Users for the admin list, newest first, optionally narrowed by nickname or full name. */
export async function listUsers(
  supabase: Db,
  { search, page, pageSize }: { search?: string; page: number; pageSize: number },
): Promise<AdminUsers> {
  const from = (page - 1) * pageSize;
  let query = supabase
    .from("profiles")
    .select("id, nickname, full_name, role, created_at, last_login_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  const term = search ? sanitizeSearch(search) : "";
  if (term) query = query.or(`nickname.ilike.%${term}%,full_name.ilike.%${term}%`);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      nickname: row.nickname,
      fullName: row.full_name,
      role: row.role === "admin" ? "admin" : "user",
      createdAt: new Date(row.created_at).toISOString(),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    })),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/** Grants or revokes the admin role. The database refuses to demote the last admin. */
export async function setUserRole(
  supabase: Db,
  { userId, role }: AdminUserRoleBody,
): Promise<{ userId: string; role: "user" | "admin" }> {
  const { data: target, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!target) {
    throw new ApiError(404, ERROR_CODES.profileNotFound, "Not Found", "User does not exist.");
  }

  const { error } = await supabase.rpc("set_user_role", { target: userId, new_role: role });
  if (error) {
    if (error.message.includes("last admin")) {
      throw new ApiError(
        409,
        ERROR_CODES.lastAdmin,
        "Conflict",
        "The last admin cannot be demoted. Make another user an admin first.",
      );
    }
    if (error.code === "42501") {
      throw new ApiError(403, ERROR_CODES.forbidden, "Forbidden", "Admin role required.");
    }
    throw error;
  }
  return { userId, role };
}

function toUserProfile(row: Tables<"profiles">): AdminUserProfile {
  return {
    userId: row.id,
    nickname: row.nickname,
    fullName: row.full_name,
    contact: row.contact,
    about: row.about,
    countryCode: row.country_code,
    city: row.city,
    utcOffsetMinutes: row.utc_offset_minutes,
    avatarUrl: avatarUrl(row.avatar_path),
  };
}

const notFound = () =>
  new ApiError(404, ERROR_CODES.profileNotFound, "Not Found", "User does not exist.");

/** One participant's profile for the admin edit form; null when there is no such user. */
export async function getUserProfile(
  supabase: Db,
  userId: string,
): Promise<AdminUserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toUserProfile(data) : null;
}

/**
 * An admin changes somebody's profile. Runs with the secret key (RLS lets only the owner write), so
 * the caller must already be checked as an admin. Same fields as the owner's own edit; a photo can
 * only be removed. The log names who changed whom and which fields, never the values.
 */
export async function updateUserProfile(
  supabase: Db,
  { userId, patch }: AdminUserProfileBody,
  actorId: string,
): Promise<AdminUserProfile> {
  if (patch.avatarPath !== undefined && patch.avatarPath !== null) {
    throw new ApiError(
      422,
      ERROR_CODES.validationFailed,
      "Unprocessable Content",
      "An admin can only remove the photo.",
      [{ field: "avatarPath", message: "Админ может только убрать фото" }],
    );
  }

  const update: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (patch.nickname !== undefined) update.nickname = patch.nickname;
  if (patch.fullName !== undefined) update.full_name = patch.fullName;
  if (patch.contact !== undefined) update.contact = patch.contact;
  if (patch.about !== undefined) update.about = patch.about;
  if (patch.countryCode !== undefined) update.country_code = patch.countryCode;
  if (patch.city !== undefined) update.city = patch.city;
  if (patch.avatarPath !== undefined) update.avatar_path = patch.avatarPath;
  if (patch.utcOffsetMinutes !== undefined) update.utc_offset_minutes = patch.utcOffsetMinutes;

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", userId)
    .select("*")
    .maybeSingle();
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
  if (!data) throw notFound();

  log("info", "admin.profile_updated", {
    actor: actorId,
    target: userId,
    fields: Object.keys(update),
  });
  return toUserProfile(data);
}
