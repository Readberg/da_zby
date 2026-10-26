import type { SupabaseClient } from "@supabase/supabase-js";
import type { TournamentFields, TournamentUpdate } from "@/lib/admin-schema";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type { Tournament } from "@/server/api/v1/schemas/admin-catalog";
import type { Database, Tables } from "@/types/database";
import { UNIQUE_VIOLATION } from "./pg-errors";

type Db = SupabaseClient<Database>;

function toDto(row: Tables<"tournaments">): Tournament {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    pointsExact: row.points_exact,
    pointsOutcome: row.points_outcome,
    isActive: row.is_active,
  };
}

/** A unique violation names the constraint; map it to the field the form should mark. */
function duplicateError(message: string): ApiError {
  const field = message.includes("slug") ? "slug" : "name";
  return new ApiError(
    409,
    ERROR_CODES.duplicate,
    "Conflict",
    field === "slug"
      ? "A tournament with this slug exists."
      : "A tournament with this name exists.",
    [
      {
        field,
        message: field === "slug" ? "Такой slug уже занят" : "Турнир с таким названием уже есть",
      },
    ],
  );
}

export async function listTournaments(supabase: Db): Promise<{ items: Tournament[] }> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return { items: (data ?? []).map(toDto) };
}

export async function createTournament(supabase: Db, fields: TournamentFields) {
  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      name: fields.name,
      slug: fields.slug,
      points_exact: fields.pointsExact,
      points_outcome: fields.pointsOutcome,
      is_active: fields.isActive,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw duplicateError(error.message);
    throw error;
  }
  return toDto(data);
}

export async function updateTournament(supabase: Db, { id, ...fields }: TournamentUpdate) {
  const patch: Database["public"]["Tables"]["tournaments"]["Update"] = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.slug !== undefined) patch.slug = fields.slug;
  if (fields.pointsExact !== undefined) patch.points_exact = fields.pointsExact;
  if (fields.pointsOutcome !== undefined) patch.points_outcome = fields.pointsOutcome;
  if (fields.isActive !== undefined) patch.is_active = fields.isActive;

  const query =
    Object.keys(patch).length > 0
      ? supabase.from("tournaments").update(patch).eq("id", id).select("*").maybeSingle()
      : supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
  const { data, error } = await query;
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw duplicateError(error.message);
    throw error;
  }
  if (!data) {
    throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "Tournament does not exist.");
  }
  return toDto(data);
}

/** Re-grades every season of the tournament (after the points settings changed). */
export async function recalculateTournament(
  supabase: Db,
  tournamentId: string,
): Promise<{ seasons: number }> {
  const { data: tournament, error: lookupError } = await supabase
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!tournament) {
    throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "Tournament does not exist.");
  }

  const { data: seasons, error } = await supabase
    .from("seasons")
    .select("id")
    .eq("tournament_id", tournamentId);
  if (error) throw error;

  for (const season of seasons ?? []) {
    const { error: rpcError } = await supabase.rpc("recalculate_season", {
      p_season_id: season.id,
    });
    if (rpcError) throw rpcError;
  }
  return { seasons: seasons?.length ?? 0 };
}
