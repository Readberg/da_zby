import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchCreate, MatchUpdate, TourCreate, TourUpdate } from "@/lib/admin-season-schema";
import { ApiError, ERROR_CODES, type FieldError } from "@/server/api/v1/problem";
import type { MatchDto, TourDetail, TourSummary } from "@/server/api/v1/schemas/admin-season";
import type { Database, Tables } from "@/types/database";
import { assertSeasonOpen, seasonNotFound } from "./admin-seasons";
import { UNIQUE_VIOLATION } from "./pg-errors";

type Db = SupabaseClient<Database>;

function notFound(what: string) {
  return new ApiError(404, ERROR_CODES.notFound, "Not Found", `${what} does not exist.`);
}

function invalid(detail: string, errors: FieldError[]) {
  return new ApiError(422, ERROR_CODES.validationFailed, "Unprocessable Content", detail, errors);
}

function duplicateNumber() {
  return new ApiError(
    409,
    ERROR_CODES.duplicate,
    "Conflict",
    "A tour with this number exists in the season.",
    [{ field: "number", message: "Тур с таким номером уже есть в сезоне" }],
  );
}

function iso(value: string | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

export async function loadTour(db: Db, tourId: string): Promise<Tables<"tours">> {
  const { data, error } = await db.from("tours").select("*").eq("id", tourId).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Tour");
  return data;
}

export async function rosterIds(db: Db, seasonId: string): Promise<string[]> {
  const { data, error } = await db.from("season_clubs").select("club_id").eq("season_id", seasonId);
  if (error) throw error;
  return (data ?? []).map((row) => row.club_id);
}

function tourSummary(
  tour: Tables<"tours">,
  matchesCount: number,
  deadlineAt: string | null,
): TourSummary {
  return {
    id: tour.id,
    seasonId: tour.season_id,
    number: tour.number,
    title: tour.title,
    deadlineOverride: iso(tour.deadline_override),
    deadlineAt: iso(deadlineAt),
    matchesCount,
  };
}

export async function getTour(db: Db, tourId: string): Promise<TourDetail> {
  const tour = await loadTour(db, tourId);
  const [season, matches, roster, deadline] = await Promise.all([
    db.from("seasons").select("id, name, status").eq("id", tour.season_id).maybeSingle(),
    db.from("matches").select("*").eq("tour_id", tourId).order("kickoff_at", { ascending: true }),
    rosterIds(db, tour.season_id),
    db.rpc("tour_deadline", { p_tour_id: tourId }),
  ]);
  if (season.error) throw season.error;
  if (!season.data) throw seasonNotFound();
  if (matches.error) throw matches.error;

  const matchRows = matches.data ?? [];
  const clubIds = [
    ...new Set([...roster, ...matchRows.flatMap((m) => [m.home_club_id, m.away_club_id])]),
  ];
  const { data: clubs, error: clubsError } =
    clubIds.length > 0
      ? await db.from("clubs").select("id, name").in("id", clubIds).order("name")
      : { data: [] as { id: string; name: string }[], error: null };
  if (clubsError) throw clubsError;
  const names = new Map((clubs ?? []).map((c) => [c.id, c.name]));

  const matchDtos: MatchDto[] = matchRows.map((m) => ({
    id: m.id,
    tourId: m.tour_id,
    homeClubId: m.home_club_id,
    awayClubId: m.away_club_id,
    homeName: names.get(m.home_club_id) ?? "?",
    awayName: names.get(m.away_club_id) ?? "?",
    kickoffAt: new Date(m.kickoff_at).toISOString(),
    status: m.status as MatchDto["status"],
    homeScore: m.home_score,
    awayScore: m.away_score,
  }));

  return {
    tour: tourSummary(tour, matchRows.length, deadline.data ?? null),
    season: {
      id: season.data.id,
      name: season.data.name,
      status: season.data.status === "closed" ? "closed" : "active",
    },
    clubs: (clubs ?? []).filter((c) => roster.includes(c.id)),
    matches: matchDtos,
  };
}

export async function createTour(db: Db, input: TourCreate): Promise<TourSummary> {
  await assertSeasonOpen(db, input.seasonId);

  let number = input.number;
  if (number === undefined) {
    const { data, error } = await db
      .from("tours")
      .select("number")
      .eq("season_id", input.seasonId)
      .order("number", { ascending: false })
      .limit(1);
    if (error) throw error;
    number = (data?.[0]?.number ?? 0) + 1;
  }

  const { data, error } = await db
    .from("tours")
    .insert({
      season_id: input.seasonId,
      number,
      title: input.title ?? null,
      deadline_override: input.deadlineOverride ?? null,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw duplicateNumber();
    throw error;
  }
  return tourSummary(data, 0, null);
}

export async function updateTour(db: Db, { id, ...fields }: TourUpdate): Promise<TourSummary> {
  const tour = await loadTour(db, id);
  await assertSeasonOpen(db, tour.season_id);

  const patch: Database["public"]["Tables"]["tours"]["Update"] = {};
  if (fields.number !== undefined) patch.number = fields.number;
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.deadlineOverride !== undefined) patch.deadline_override = fields.deadlineOverride;

  let updated = tour;
  if (Object.keys(patch).length > 0) {
    const { data, error } = await db.from("tours").update(patch).eq("id", id).select("*").single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw duplicateNumber();
      throw error;
    }
    updated = data;
  }

  const [count, deadline] = await Promise.all([
    db.from("matches").select("id", { count: "exact", head: true }).eq("tour_id", id),
    db.rpc("tour_deadline", { p_tour_id: id }),
  ]);
  return tourSummary(updated, count.count ?? 0, deadline.data ?? null);
}

/** A tour with matches is not deleted: that would also wipe the predictions. */
export async function deleteTour(db: Db, id: string): Promise<{ id: string }> {
  const tour = await loadTour(db, id);
  await assertSeasonOpen(db, tour.season_id);

  const { count, error: countError } = await db
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("tour_id", id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new ApiError(
      409,
      ERROR_CODES.inUse,
      "Conflict",
      "The tour has matches. Delete them first.",
    );
  }
  const { error } = await db.from("tours").delete().eq("id", id);
  if (error) throw error;
  return { id };
}

function toMatchDto(row: Tables<"matches">, homeName = "", awayName = ""): MatchDto {
  return {
    id: row.id,
    tourId: row.tour_id,
    homeClubId: row.home_club_id,
    awayClubId: row.away_club_id,
    homeName,
    awayName,
    kickoffAt: new Date(row.kickoff_at).toISOString(),
    status: row.status as MatchDto["status"],
    homeScore: row.home_score,
    awayScore: row.away_score,
  };
}

async function assertInRoster(db: Db, seasonId: string, clubs: Record<string, string>) {
  const roster = await rosterIds(db, seasonId);
  const errors: FieldError[] = Object.entries(clubs)
    .filter(([, clubId]) => !roster.includes(clubId))
    .map(([field]) => ({ field, message: "Клуб не входит в состав сезона" }));
  if (errors.length > 0) throw invalid("A club does not take part in the season.", errors);
}

async function clubNames(db: Db, ids: string[]): Promise<Map<string, string>> {
  const { data, error } = await db.from("clubs").select("id, name").in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((c) => [c.id, c.name]));
}

export async function createMatch(db: Db, input: MatchCreate): Promise<MatchDto> {
  const tour = await loadTour(db, input.tourId);
  await assertSeasonOpen(db, tour.season_id);
  await assertInRoster(db, tour.season_id, {
    homeClubId: input.homeClubId,
    awayClubId: input.awayClubId,
  });

  const { data, error } = await db
    .from("matches")
    .insert({
      tour_id: input.tourId,
      home_club_id: input.homeClubId,
      away_club_id: input.awayClubId,
      kickoff_at: new Date(input.kickoffAt).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  const names = await clubNames(db, [input.homeClubId, input.awayClubId]);
  return toMatchDto(data, names.get(input.homeClubId), names.get(input.awayClubId));
}

/**
 * Changes a match or enters its result. A finished match needs both scores; any other status
 * clears them. Points are (re)graded by the database trigger as soon as the row changes.
 */
export async function updateMatch(db: Db, { id, ...fields }: MatchUpdate): Promise<MatchDto> {
  const { data: current, error: loadError } = await db
    .from("matches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!current) throw notFound("Match");

  const tour = await loadTour(db, current.tour_id);
  await assertSeasonOpen(db, tour.season_id);

  const homeClubId = fields.homeClubId ?? current.home_club_id;
  const awayClubId = fields.awayClubId ?? current.away_club_id;
  const status = fields.status ?? (current.status as MatchDto["status"]);
  const errors: FieldError[] = [];

  if (homeClubId === awayClubId) {
    errors.push({ field: "awayClubId", message: "Хозяева и гости должны быть разными клубами" });
  }

  let homeScore: number | null;
  let awayScore: number | null;
  if (status === "finished") {
    homeScore = fields.homeScore !== undefined ? fields.homeScore : current.home_score;
    awayScore = fields.awayScore !== undefined ? fields.awayScore : current.away_score;
    if (homeScore === null) errors.push({ field: "homeScore", message: "Укажите счёт хозяев" });
    if (awayScore === null) errors.push({ field: "awayScore", message: "Укажите счёт гостей" });
  } else {
    homeScore = null;
    awayScore = null;
  }
  if (errors.length > 0) throw invalid("The match data is not consistent.", errors);

  const changedClubs: Record<string, string> = {};
  if (fields.homeClubId) changedClubs.homeClubId = fields.homeClubId;
  if (fields.awayClubId) changedClubs.awayClubId = fields.awayClubId;
  if (Object.keys(changedClubs).length > 0) await assertInRoster(db, tour.season_id, changedClubs);

  const { data, error } = await db
    .from("matches")
    .update({
      home_club_id: homeClubId,
      away_club_id: awayClubId,
      kickoff_at: fields.kickoffAt ? new Date(fields.kickoffAt).toISOString() : current.kickoff_at,
      status,
      home_score: homeScore,
      away_score: awayScore,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const names = await clubNames(db, [homeClubId, awayClubId]);
  return toMatchDto(data, names.get(homeClubId), names.get(awayClubId));
}

/** A match with predictions is not deleted: cancel it instead, so nothing is lost silently. */
export async function deleteMatch(db: Db, id: string): Promise<{ id: string }> {
  const { data: match, error } = await db
    .from("matches")
    .select("id, tour_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!match) throw notFound("Match");

  const tour = await loadTour(db, match.tour_id);
  await assertSeasonOpen(db, tour.season_id);

  const { count, error: countError } = await db
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("match_id", id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new ApiError(
      409,
      ERROR_CODES.inUse,
      "Conflict",
      "The match has predictions. Set its status to cancelled instead of deleting it.",
    );
  }
  const { error: deleteError } = await db.from("matches").delete().eq("id", id);
  if (deleteError) throw deleteError;
  return { id };
}
