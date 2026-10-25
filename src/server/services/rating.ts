import type { SupabaseClient } from "@supabase/supabase-js";
import { avatarUrl } from "@/lib/avatar";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

export type RatingRow = {
  userId: string;
  nickname: string | null;
  avatarUrl: string | null;
  /** Place: shared by participants with equal points, exact scores and outcomes. */
  place: number | null;
  /** The place is the final one of a closed season. */
  final: boolean;
  exactCount: number;
  outcomeCount: number;
  missCount: number;
  points: number;
  predictionsCount: number;
};

export type TourMatch = {
  id: string;
  kickoffAt: string;
  status: "scheduled" | "finished" | "postponed" | "cancelled";
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type PredictionCell = {
  homeScore: number;
  awayScore: number;
  result: "exact" | "outcome" | "miss" | null;
  points: number | null;
};

export type RatingPageData = {
  tournaments: { id: string; slug: string; name: string }[];
  tournament: { id: string; slug: string; name: string } | null;
  seasons: { id: string; name: string; status: "active" | "closed" }[];
  season: { id: string; name: string; status: "active" | "closed" } | null;
  tours: { number: number; title: string | null }[];
  /** Null: the table of the whole season. */
  tour: { id: string; number: number; title: string | null } | null;
  rows: RatingRow[];
  matches: TourMatch[];
  /** Predictions of the tour by user id, then match id (tour view only). */
  cells: Record<string, Record<string, PredictionCell>>;
};

export type StatsRow = {
  seasonId: string;
  tournamentName: string;
  seasonName: string;
  predictionsCount: number;
  winsCount: number;
  lossesCount: number;
  points: number;
  /** Percent of won predictions among graded ones; null while nothing is graded. */
  winRate: number | null;
  place: number | null;
  final: boolean;
};

type Raw = {
  user_id: string | null;
  exact_count: number | null;
  outcome_count: number | null;
  miss_count: number | null;
  points: number | null;
  predictions_count: number | null;
  current_rank: number | null;
  final_rank?: number | null;
  profiles: { nickname: string | null; avatar_path: string | null } | null;
};

/**
 * Table rows in the order of the ranking: place, then points, exact scores, outcomes, nickname.
 * Equal results share a place (the database ranks them). A closed season shows the final places.
 */
export function toRatingRows(rows: Raw[], seasonClosed: boolean): RatingRow[] {
  return rows
    .filter((row) => row.user_id)
    .map((row) => {
      const finalRank = seasonClosed ? (row.final_rank ?? null) : null;
      return {
        userId: row.user_id as string,
        nickname: row.profiles?.nickname ?? null,
        avatarUrl: avatarUrl(row.profiles?.avatar_path),
        place: finalRank ?? row.current_rank,
        final: finalRank !== null,
        exactCount: row.exact_count ?? 0,
        outcomeCount: row.outcome_count ?? 0,
        missCount: row.miss_count ?? 0,
        points: row.points ?? 0,
        predictionsCount: row.predictions_count ?? 0,
      };
    })
    .sort(
      (a, b) =>
        (a.place ?? Infinity) - (b.place ?? Infinity) ||
        b.points - a.points ||
        b.exactCount - a.exactCount ||
        b.outcomeCount - a.outcomeCount ||
        (a.nickname ?? "").localeCompare(b.nickname ?? "", "ru"),
    );
}

/** Wins are exact scores and right outcomes, losses are misses; ungraded predictions count in neither. */
export function winRate(wins: number, losses: number): number | null {
  const graded = wins + losses;
  return graded === 0 ? null : Math.round((1000 * wins) / graded) / 10;
}

const status = (value: string): "active" | "closed" => (value === "closed" ? "closed" : "active");

/** Data of the rating page: catalogue, then the season table or one tour with every prediction. */
export async function getRatingPage(
  db: Db,
  choice: { tournament?: string; season?: string; tour?: number },
): Promise<RatingPageData> {
  const [tournamentsResult, seasonsResult] = await Promise.all([
    db.from("tournaments").select("id, slug, name").eq("is_active", true).order("created_at"),
    db.from("seasons").select("id, name, status, tournament_id, created_at"),
  ]);
  for (const result of [tournamentsResult, seasonsResult]) if (result.error) throw result.error;

  const tournaments = tournamentsResult.data ?? [];
  const tournament =
    tournaments.find((t) => t.slug === choice.tournament) ?? tournaments[0] ?? null;
  const seasons = (seasonsResult.data ?? [])
    .filter((s) => s.tournament_id === tournament?.id)
    .sort((a, b) =>
      a.status !== b.status
        ? a.status === "active"
          ? -1
          : 1
        : b.created_at.localeCompare(a.created_at),
    )
    .map((s) => ({ id: s.id, name: s.name, status: status(s.status) }));
  const season = seasons.find((s) => s.id === choice.season) ?? seasons[0] ?? null;

  const base: RatingPageData = {
    tournaments,
    tournament,
    seasons,
    season,
    tours: [],
    tour: null,
    rows: [],
    matches: [],
    cells: {},
  };
  if (!season) return base;
  const closed = season.status === "closed";

  const [toursResult, boardResult] = await Promise.all([
    db.from("tours").select("id, number, title").eq("season_id", season.id).order("number"),
    db
      .from("season_leaderboard")
      .select("*, profiles(nickname, avatar_path)")
      .eq("season_id", season.id),
  ]);
  for (const result of [toursResult, boardResult]) if (result.error) throw result.error;

  const tourRows = toursResult.data ?? [];
  const tours = tourRows.map((t) => ({ number: t.number, title: t.title }));
  const chosen =
    choice.tour !== undefined ? tourRows.find((t) => t.number === choice.tour) : undefined;

  if (!chosen) {
    return { ...base, tours, rows: toRatingRows((boardResult.data ?? []) as Raw[], closed) };
  }

  const [tourBoard, matchesResult, clubsResult] = await Promise.all([
    db
      .from("tour_leaderboard")
      .select("*, profiles(nickname, avatar_path)")
      .eq("tour_id", chosen.id),
    db.from("matches").select("*").eq("tour_id", chosen.id).order("kickoff_at"),
    db.from("clubs").select("id, name"),
  ]);
  for (const result of [tourBoard, matchesResult, clubsResult])
    if (result.error) throw result.error;

  const matchRows = matchesResult.data ?? [];
  const names = new Map((clubsResult.data ?? []).map((c) => [c.id, c.name]));
  const matches: TourMatch[] = matchRows.map((m) => ({
    id: m.id,
    kickoffAt: new Date(m.kickoff_at).toISOString(),
    status: m.status as TourMatch["status"],
    homeName: names.get(m.home_club_id) ?? "?",
    awayName: names.get(m.away_club_id) ?? "?",
    homeScore: m.home_score,
    awayScore: m.away_score,
  }));

  const cells: RatingPageData["cells"] = {};
  if (matchRows.length > 0) {
    const { data: predictions, error } = await db
      .from("predictions")
      .select("user_id, match_id, home_score, away_score, result, points")
      .in(
        "match_id",
        matchRows.map((m) => m.id),
      );
    if (error) throw error;
    for (const p of predictions ?? []) {
      (cells[p.user_id] ??= {})[p.match_id] = {
        homeScore: p.home_score,
        awayScore: p.away_score,
        result: (p.result as PredictionCell["result"]) ?? null,
        points: p.points,
      };
    }
  }

  return {
    ...base,
    tours,
    tour: { id: chosen.id, number: chosen.number, title: chosen.title },
    rows: toRatingRows((tourBoard.data ?? []) as Raw[], false),
    matches,
    cells,
  };
}

/** One row per tournament + season in which the user has predictions. */
export async function getProfileStats(db: Db, userId: string): Promise<StatsRow[]> {
  const { data, error } = await db
    .from("season_leaderboard")
    .select("*, seasons(name, status, created_at, tournaments(name))")
    .eq("user_id", userId);
  if (error) throw error;

  type Joined = {
    season_id: string | null;
    predictions_count: number | null;
    wins_count: number | null;
    losses_count: number | null;
    points: number | null;
    win_rate: number | null;
    current_rank: number | null;
    final_rank: number | null;
    seasons: {
      name: string;
      status: string;
      created_at: string;
      tournaments: { name: string } | null;
    } | null;
  };

  return ((data ?? []) as unknown as Joined[])
    .filter((row) => row.season_id && row.seasons)
    .sort((a, b) => b.seasons!.created_at.localeCompare(a.seasons!.created_at))
    .map((row) => {
      const closed = row.seasons!.status === "closed";
      const finalRank = closed ? row.final_rank : null;
      return {
        seasonId: row.season_id as string,
        tournamentName: row.seasons!.tournaments?.name ?? "",
        seasonName: row.seasons!.name,
        predictionsCount: row.predictions_count ?? 0,
        winsCount: row.wins_count ?? 0,
        lossesCount: row.losses_count ?? 0,
        points: row.points ?? 0,
        winRate: row.win_rate,
        place: finalRank ?? row.current_rank,
        final: finalRank !== null,
      };
    });
}
