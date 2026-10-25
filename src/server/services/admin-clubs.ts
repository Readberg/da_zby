import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClubFields, ClubUpdate } from "@/lib/admin-schema";
import { clubLogoUrl } from "@/lib/club-logo-url";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type { Club } from "@/server/api/v1/schemas/admin-catalog";
import type { Database, Tables } from "@/types/database";

type Db = SupabaseClient<Database>;

const FOREIGN_KEY_VIOLATION = "23503";

function toDto(row: Tables<"clubs">): Club {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    logoPath: row.logo_path,
    logoUrl: clubLogoUrl(row.logo_path),
  };
}

function notFound() {
  return new ApiError(404, ERROR_CODES.notFound, "Not Found", "Club does not exist.");
}

export async function listClubs(supabase: Db): Promise<{ items: Club[] }> {
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return { items: (data ?? []).map(toDto) };
}

export async function createClub(supabase: Db, fields: ClubFields): Promise<Club> {
  const { data, error } = await supabase
    .from("clubs")
    .insert({ name: fields.name, short_name: fields.shortName, logo_path: fields.logoPath })
    .select("*")
    .single();
  if (error) throw error;
  return toDto(data);
}

export async function updateClub(supabase: Db, { id, ...fields }: ClubUpdate): Promise<Club> {
  const patch: Database["public"]["Tables"]["clubs"]["Update"] = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.shortName !== undefined) patch.short_name = fields.shortName;
  if (fields.logoPath !== undefined) patch.logo_path = fields.logoPath;

  const query =
    Object.keys(patch).length > 0
      ? supabase.from("clubs").update(patch).eq("id", id).select("*").maybeSingle()
      : supabase.from("clubs").select("*").eq("id", id).maybeSingle();
  const { data, error } = await query;
  if (error) throw error;
  if (!data) throw notFound();
  return toDto(data);
}

/** Deleting a club that already has matches is refused by the database (on delete restrict). */
export async function deleteClub(supabase: Db, id: string): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("clubs")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      throw new ApiError(
        409,
        ERROR_CODES.inUse,
        "Conflict",
        "The club has matches and cannot be deleted.",
      );
    }
    throw error;
  }
  if (!data) throw notFound();
  return { id };
}
