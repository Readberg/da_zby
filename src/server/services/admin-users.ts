import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type { AdminUserRoleBody, AdminUsers } from "@/server/api/v1/schemas/admin";
import type { Database } from "@/types/database";

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
