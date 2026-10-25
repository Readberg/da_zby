import type { SupabaseClient } from "@supabase/supabase-js";
import type { SeasonClubsBody, SeasonCreate } from "@/lib/admin-season-schema";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type {
  SeasonDetail,
  SeasonSummary,
  TourSummary,
} from "@/server/api/v1/schemas/admin-season";
import type { Database, Tables } from "@/types/database";

type Db = SupabaseClient<Database>;

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

export function seasonNotFound() {
  return new ApiError(404, ERROR_CODES.notFound, "Not Found", "Season does not exist.");
}

function tally(rows: { season_id: string }[] | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows ?? []) counts.set(row.season_id, (counts.get(row.season_id) ?? 0) + 1);
  return counts;
}

function toSummary(
  row: Tables<"seasons">,
  tournamentName: string,
  clubsCount: number,
  toursCount: number,
): SeasonSummary {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    tournamentName,
    name: row.name,
    status: row.status === "closed" ? "closed" : "active",
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    clubsCount,
    toursCount,
  };
}

async function loadSeason(db: Db, seasonId: string): Promise<Tables<"seasons">> {
  const { data, error } = await db.from("seasons").select("*").eq("id", seasonId).maybeSingle();
  if (error) throw error;
  if (!data) throw seasonNotFound();
  return data;
}

/** Edits of tours, matches and the roster are refused while the season is closed. */
export async function assertSeasonOpen(db: Db, seasonId: string): Promise<void> {
  const season = await loadSeason(db, seasonId);
  if (season.status === "closed") {
    throw new ApiError(
      409,
      ERROR_CODES.seasonClosed,
      "Conflict",
      "The season is closed. Reopen it to make changes.",
    );
  }
}

export async function listSeasons(db: Db): Promise<{ items: SeasonSummary[] }> {
  const [seasons, tournaments, clubs, tours] = await Promise.all([
    db.from("seasons").select("*").order("created_at", { ascending: false }),
    db.from("tournaments").select("id, name"),
    db.from("season_clubs").select("season_id"),
    db.from("tours").select("season_id"),
  ]);
  for (const result of [seasons, tournaments, clubs, tours]) if (result.error) throw result.error;

  const names = new Map((tournaments.data ?? []).map((t) => [t.id, t.name]));
  const clubCounts = tally(clubs.data);
  const tourCounts = tally(tours.data);
  return {
    items: (seasons.data ?? []).map((season) =>
      toSummary(
        season,
        names.get(season.tournament_id) ?? "",
        clubCounts.get(season.id) ?? 0,
        tourCounts.get(season.id) ?? 0,
      ),
    ),
  };
}

export async function createSeason(
  db: Db,
  { tournamentId, name, copyFromSeasonId }: SeasonCreate,
): Promise<SeasonSummary> {
  const { data: tournament, error: tournamentError } = await db
    .from("tournaments")
    .select("id, name")
    .eq("id", tournamentId)
    .maybeSingle();
  if (tournamentError) throw tournamentError;
  if (!tournament) {
    throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "Tournament does not exist.");
  }

  const { data: season, error } = await db
    .from("seasons")
    .insert({ tournament_id: tournamentId, name })
    .select("*")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new ApiError(
        409,
        ERROR_CODES.duplicate,
        "Conflict",
        "A season with this name exists in the tournament.",
        [{ field: "name", message: "Сезон с таким названием в этом турнире уже есть" }],
      );
    }
    throw error;
  }

  let clubsCount = 0;
  if (copyFromSeasonId) {
    const { data: roster, error: rosterError } = await db
      .from("season_clubs")
      .select("club_id")
      .eq("season_id", copyFromSeasonId);
    if (rosterError) throw rosterError;
    if (roster && roster.length > 0) {
      const { error: copyError } = await db
        .from("season_clubs")
        .insert(roster.map((row) => ({ season_id: season.id, club_id: row.club_id })));
      if (copyError) throw copyError;
      clubsCount = roster.length;
    }
  }
  return toSummary(season, tournament.name, clubsCount, 0);
}

export async function getSeason(db: Db, seasonId: string): Promise<SeasonDetail> {
  const season = await loadSeason(db, seasonId);
  const [tournament, roster, tours] = await Promise.all([
    db.from("tournaments").select("name").eq("id", season.tournament_id).maybeSingle(),
    db.from("season_clubs").select("club_id").eq("season_id", seasonId),
    db.from("tours").select("*").eq("season_id", seasonId).order("number", { ascending: true }),
  ]);
  for (const result of [tournament, roster, tours]) if (result.error) throw result.error;

  const tourRows = tours.data ?? [];
  const tourIds = tourRows.map((t) => t.id);
  const [matches, deadlines] = await Promise.all([
    tourIds.length > 0
      ? db.from("matches").select("tour_id").in("tour_id", tourIds)
      : Promise.resolve({ data: [] as { tour_id: string }[], error: null }),
    Promise.all(tourIds.map((id) => db.rpc("tour_deadline", { p_tour_id: id }))),
  ]);
  if (matches.error) throw matches.error;

  const matchCounts = new Map<string, number>();
  for (const m of matches.data ?? [])
    matchCounts.set(m.tour_id, (matchCounts.get(m.tour_id) ?? 0) + 1);

  const tourDtos: TourSummary[] = tourRows.map((tour, index) => {
    const deadline = deadlines[index]?.data ?? null;
    return {
      id: tour.id,
      seasonId: tour.season_id,
      number: tour.number,
      title: tour.title,
      deadlineOverride: tour.deadline_override
        ? new Date(tour.deadline_override).toISOString()
        : null,
      deadlineAt: deadline ? new Date(deadline).toISOString() : null,
      matchesCount: matchCounts.get(tour.id) ?? 0,
    };
  });

  return {
    season: toSummary(
      season,
      tournament.data?.name ?? "",
      roster.data?.length ?? 0,
      tourRows.length,
    ),
    clubIds: (roster.data ?? []).map((row) => row.club_id),
    tours: tourDtos,
  };
}

/** Replaces the season's roster. A club that already plays a match of the season cannot be removed. */
export async function setSeasonClubs(
  db: Db,
  { seasonId, clubIds }: SeasonClubsBody,
): Promise<{ clubIds: string[] }> {
  await assertSeasonOpen(db, seasonId);
  const wanted = [...new Set(clubIds)];

  const { data: current, error } = await db
    .from("season_clubs")
    .select("club_id")
    .eq("season_id", seasonId);
  if (error) throw error;
  const have = new Set((current ?? []).map((row) => row.club_id));
  const removed = [...have].filter((id) => !wanted.includes(id));
  const added = wanted.filter((id) => !have.has(id));

  if (removed.length > 0) {
    const { data: tours } = await db.from("tours").select("id").eq("season_id", seasonId);
    const tourIds = (tours ?? []).map((t) => t.id);
    if (tourIds.length > 0) {
      const { data: used, error: usedError } = await db
        .from("matches")
        .select("home_club_id, away_club_id")
        .in("tour_id", tourIds)
        .or(`home_club_id.in.(${removed.join(",")}),away_club_id.in.(${removed.join(",")})`);
      if (usedError) throw usedError;
      if ((used ?? []).length > 0) {
        throw new ApiError(
          409,
          ERROR_CODES.inUse,
          "Conflict",
          "A club that plays a match of the season cannot be removed from it.",
          [{ field: "clubIds", message: "Нельзя убрать клуб, у которого уже есть матчи сезона" }],
        );
      }
    }
    const { error: deleteError } = await db
      .from("season_clubs")
      .delete()
      .eq("season_id", seasonId)
      .in("club_id", removed);
    if (deleteError) throw deleteError;
  }

  if (added.length > 0) {
    const { error: insertError } = await db
      .from("season_clubs")
      .insert(added.map((club_id) => ({ season_id: seasonId, club_id })));
    if (insertError) {
      if (insertError.code === FOREIGN_KEY_VIOLATION) {
        throw new ApiError(
          422,
          ERROR_CODES.validationFailed,
          "Unprocessable Content",
          "Some clubs do not exist.",
          [{ field: "clubIds", message: "Часть клубов не найдена" }],
        );
      }
      throw insertError;
    }
  }
  return { clubIds: wanted };
}

function wrongState(detail: string, message: string) {
  return new ApiError(409, ERROR_CODES.seasonState, "Conflict", detail, [
    { field: "seasonId", message },
  ]);
}

/** Fixes the final places and closes the season. */
export async function closeSeason(db: Db, seasonId: string) {
  const season = await loadSeason(db, seasonId);
  if (season.status === "closed") {
    throw wrongState("The season is already closed.", "Сезон уже закрыт");
  }
  const { error } = await db.rpc("close_season", { p_season_id: seasonId });
  if (error) throw error;
  return { seasonId, status: "closed" as const };
}

/** Rolls the closing back: final places are dropped, the season is active again. */
export async function reopenSeason(db: Db, seasonId: string) {
  const season = await loadSeason(db, seasonId);
  if (season.status !== "closed") {
    throw wrongState("The season is not closed.", "Сезон не закрыт");
  }
  const { error } = await db.rpc("reopen_season", { p_season_id: seasonId });
  if (error) throw error;
  return { seasonId, status: "active" as const };
}

export async function recalculateSeason(db: Db, seasonId: string) {
  await loadSeason(db, seasonId);
  const { error } = await db.rpc("recalculate_season", { p_season_id: seasonId });
  if (error) throw error;
  return { seasonId };
}
