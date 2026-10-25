import type { SupabaseClient } from "@supabase/supabase-js";
import { clubLogoUrl } from "@/lib/club-logo-url";
import {
  isMatchOpen,
  isTourOpen,
  pickCurrentTour,
  tourDeadline,
  type PredictionsBody,
} from "@/lib/predictions";
import { ApiError, ERROR_CODES, type FieldError } from "@/server/api/v1/problem";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

export type PageClub = { id: string; name: string; logoUrl: string | null };

export type PredictionView = {
  homeScore: number;
  awayScore: number;
  result: "exact" | "outcome" | "miss" | null;
  points: number | null;
};

export type MatchView = {
  id: string;
  kickoffAt: string;
  status: "scheduled" | "finished" | "postponed" | "cancelled";
  home: PageClub;
  away: PageClub;
  homeScore: number | null;
  awayScore: number | null;
  prediction: PredictionView | null;
  /** The visitor may enter or change a score for this match right now. */
  editable: boolean;
};

export type PredictionsPageData = {
  tournaments: { id: string; slug: string; name: string }[];
  tournament: {
    id: string;
    slug: string;
    name: string;
    pointsExact: number;
    pointsOutcome: number;
  } | null;
  seasons: { id: string; name: string; status: "active" | "closed" }[];
  season: { id: string; name: string; status: "active" | "closed" } | null;
  tours: { number: number; title: string | null; deadlineAt: string | null }[];
  tour: {
    id: string;
    number: number;
    title: string | null;
    deadlineAt: string | null;
    open: boolean;
  } | null;
  matches: MatchView[];
};

const UNKNOWN_CLUB: PageClub = { id: "", name: "?", logoUrl: null };

type SeasonRef = { id: string; name: string; status: "active" | "closed" };
type TournamentRef = {
  id: string;
  slug: string;
  name: string;
  pointsExact: number;
  pointsOutcome: number;
};

/** Match as everybody sees it: no visitor-specific data, no clock-dependent flags. */
export type PublicMatch = {
  id: string;
  tourId: string;
  kickoffAt: string;
  status: MatchView["status"];
  home: PageClub;
  away: PageClub;
  homeScore: number | null;
  awayScore: number | null;
};

/**
 * Public part of the predictions page: the catalogue and every tour and match of the chosen
 * season. It is the same for all visitors and does not depend on the current time, so it can be
 * cached; the visitor's own predictions and the deadline checks are added by `composePredictionsPage`.
 */
export type PredictionsPublic = {
  tournaments: TournamentRef[];
  tournament: TournamentRef | null;
  seasons: SeasonRef[];
  season: SeasonRef | null;
  tours: { id: string; number: number; title: string | null; deadlineOverride: string | null }[];
  matches: PublicMatch[];
};

export async function getPredictionsPublic(
  db: Db,
  choice: { tournament?: string; season?: string },
): Promise<PredictionsPublic> {
  const [tournamentsResult, seasonsResult, clubsResult] = await Promise.all([
    db
      .from("tournaments")
      .select("id, slug, name, points_exact, points_outcome")
      .eq("is_active", true)
      .order("created_at"),
    db.from("seasons").select("id, name, status, tournament_id, created_at"),
    db.from("clubs").select("id, name, logo_path"),
  ]);
  for (const result of [tournamentsResult, seasonsResult, clubsResult]) {
    if (result.error) throw result.error;
  }

  const tournaments: TournamentRef[] = (tournamentsResult.data ?? []).map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    pointsExact: t.points_exact,
    pointsOutcome: t.points_outcome,
  }));
  const tournament =
    tournaments.find((t) => t.slug === choice.tournament) ?? tournaments[0] ?? null;

  const seasons: SeasonRef[] = (seasonsResult.data ?? [])
    .filter((s) => s.tournament_id === tournament?.id)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    })
    .map((s) => ({ id: s.id, name: s.name, status: s.status === "closed" ? "closed" : "active" }));
  const season = seasons.find((s) => s.id === choice.season) ?? seasons[0] ?? null;

  const empty: PredictionsPublic = {
    tournaments,
    tournament,
    seasons,
    season,
    tours: [],
    matches: [],
  };
  if (!season) return empty;

  const clubs = new Map<string, PageClub>(
    (clubsResult.data ?? []).map((c) => [
      c.id,
      { id: c.id, name: c.name, logoUrl: clubLogoUrl(c.logo_path) },
    ]),
  );

  const [toursResult, matchesResult] = await Promise.all([
    db.from("tours").select("*").eq("season_id", season.id).order("number"),
    db
      .from("matches")
      .select("*, tours!inner(season_id)")
      .eq("tours.season_id", season.id)
      .order("kickoff_at"),
  ]);
  for (const result of [toursResult, matchesResult]) if (result.error) throw result.error;

  return {
    ...empty,
    tours: (toursResult.data ?? []).map((t) => ({
      id: t.id,
      number: t.number,
      title: t.title,
      deadlineOverride: t.deadline_override ? new Date(t.deadline_override).toISOString() : null,
    })),
    matches: (matchesResult.data ?? []).map((m) => ({
      id: m.id,
      tourId: m.tour_id,
      kickoffAt: new Date(m.kickoff_at).toISOString(),
      status: m.status as MatchView["status"],
      home: clubs.get(m.home_club_id) ?? UNKNOWN_CLUB,
      away: clubs.get(m.away_club_id) ?? UNKNOWN_CLUB,
      homeScore: m.home_score,
      awayScore: m.away_score,
    })),
  };
}

/** The visitor's own predictions for a season by match id: always read live, never cached. */
export async function getMyPredictions(
  db: Db,
  userId: string,
  seasonId: string,
): Promise<Record<string, PredictionView>> {
  const { data, error } = await db
    .from("predictions")
    .select(
      "match_id, home_score, away_score, result, points, matches!inner(tours!inner(season_id))",
    )
    .eq("user_id", userId)
    .eq("matches.tours.season_id", seasonId);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((p) => [
      p.match_id,
      {
        homeScore: p.home_score,
        awayScore: p.away_score,
        result: (p.result as PredictionView["result"]) ?? null,
        points: p.points,
      },
    ]),
  );
}

/** Puts the clock and the visitor's predictions on top of the public data. */
export function composePredictionsPage(
  pub: PredictionsPublic,
  mine: Record<string, PredictionView>,
  tourNumber: number | undefined,
  now: Date = new Date(),
): PredictionsPageData {
  const { season } = pub;
  const base: PredictionsPageData = {
    tournaments: pub.tournaments,
    tournament: pub.tournament,
    seasons: pub.seasons,
    season,
    tours: [],
    tour: null,
    matches: [],
  };
  if (!season) return base;

  const tours = pub.tours.map((t) => ({
    ...t,
    deadline: tourDeadline(
      t.deadlineOverride,
      pub.matches
        .filter((m) => m.tourId === t.id)
        .map((m) => ({ kickoffAt: m.kickoffAt, status: m.status })),
    ),
  }));
  const toursView = tours.map((t) => ({
    number: t.number,
    title: t.title,
    deadlineAt: t.deadline ? t.deadline.toISOString() : null,
  }));

  const wanted = tourNumber !== undefined ? tours.find((t) => t.number === tourNumber) : undefined;
  const current = wanted ?? pickCurrentTour(tours, now);
  if (!current) return { ...base, tours: toursView };

  const open = isTourOpen(season.status, current.deadline, now);
  return {
    ...base,
    tours: toursView,
    tour: {
      id: current.id,
      number: current.number,
      title: current.title,
      deadlineAt: current.deadline ? current.deadline.toISOString() : null,
      open,
    },
    matches: pub.matches
      .filter((m) => m.tourId === current.id)
      .map((m) => ({
        id: m.id,
        kickoffAt: m.kickoffAt,
        status: m.status,
        home: m.home,
        away: m.away,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        prediction: mine[m.id] ?? null,
        editable: open && isMatchOpen(m.status),
      })),
  };
}

/** Everything the predictions page shows in one call (no caching): used by tests and scripts. */
export async function getPredictionsPage(
  db: Db,
  userId: string | null,
  choice: { tournament?: string; season?: string; tour?: number },
  now: Date = new Date(),
): Promise<PredictionsPageData> {
  const pub = await getPredictionsPublic(db, choice);
  const mine = userId && pub.season ? await getMyPredictions(db, userId, pub.season.id) : {};
  return composePredictionsPage(pub, mine, choice.tour, now);
}

function closed() {
  return new ApiError(
    409,
    ERROR_CODES.predictionsClosed,
    "Conflict",
    "Predictions for this tour are closed.",
  );
}

/**
 * Saves the visitor's scores for a tour: new predictions are inserted, existing ones updated.
 * RLS (`can_predict`) is the real gate — season active, match not played, deadline not passed —
 * so a closed tour ends in 409 even if the page was left open past the deadline.
 */
export async function savePredictions(
  db: Db,
  userId: string,
  { tourId, items }: PredictionsBody,
): Promise<{ saved: number }> {
  const { data: matches, error: matchesError } = await db
    .from("matches")
    .select("id")
    .eq("tour_id", tourId)
    .in(
      "id",
      items.map((item) => item.matchId),
    );
  if (matchesError) throw matchesError;

  const inTour = new Set((matches ?? []).map((m) => m.id));
  const errors: FieldError[] = items
    .filter((item) => !inTour.has(item.matchId))
    .map((item) => ({ field: item.matchId, message: "Матч не относится к этому туру" }));
  if (errors.length > 0) {
    throw new ApiError(
      422,
      ERROR_CODES.validationFailed,
      "Unprocessable Content",
      "Some matches do not belong to the tour.",
      errors,
    );
  }

  const { data: existing, error: existingError } = await db
    .from("predictions")
    .select("id, match_id")
    .eq("user_id", userId)
    .in(
      "match_id",
      items.map((item) => item.matchId),
    );
  if (existingError) throw existingError;
  const existingByMatch = new Map((existing ?? []).map((p) => [p.match_id, p.id]));

  const fresh = items.filter((item) => !existingByMatch.has(item.matchId));
  const changed = items.filter((item) => existingByMatch.has(item.matchId));

  if (fresh.length > 0) {
    const { error } = await db.from("predictions").insert(
      fresh.map((item) => ({
        user_id: userId,
        match_id: item.matchId,
        home_score: item.homeScore,
        away_score: item.awayScore,
      })),
    );
    if (error) {
      if (error.code === "42501") throw closed();
      throw error;
    }
  }

  const updates = await Promise.all(
    changed.map((item) =>
      db
        .from("predictions")
        .update({ home_score: item.homeScore, away_score: item.awayScore })
        .eq("id", existingByMatch.get(item.matchId)!)
        .select("id"),
    ),
  );
  for (const result of updates) {
    if (result.error) throw result.error;
    // A row hidden by RLS (deadline passed) is not an error for Postgres: it just matches nothing.
    if ((result.data ?? []).length === 0) throw closed();
  }

  return { saved: items.length };
}
