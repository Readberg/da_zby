import type { SupabaseClient } from "@supabase/supabase-js";
import { clubLogoUrl } from "@/lib/club-logo-url";
import {
  computeStandings,
  isCounted,
  type StandingsClub,
  type StandingsMatch,
  type StandingsRow,
} from "@/lib/standings";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

export type StandingsPageData = {
  tournaments: { id: string; slug: string; name: string }[];
  tournament: { id: string; slug: string; name: string } | null;
  seasons: { id: string; name: string; status: "active" | "closed" }[];
  season: { id: string; name: string; status: "active" | "closed" } | null;
  rows: StandingsRow[];
  /** Matches that are in the table / matches of the season that are still to be played or entered. */
  counted: number;
  total: number;
};

/**
 * Data of the championship table page (DAZBY-126): the real league table, worked out from the
 * results the admins enter, not the prediction rating. Same tournament and season choice as the
 * rating pages.
 */
export async function getStandingsPage(
  db: Db,
  choice: { tournament?: string; season?: string },
): Promise<StandingsPageData> {
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
    .map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status === "closed" ? ("closed" as const) : ("active" as const),
    }));
  const season = seasons.find((s) => s.id === choice.season) ?? seasons[0] ?? null;

  const empty: StandingsPageData = {
    tournaments,
    tournament,
    seasons,
    season,
    rows: [],
    counted: 0,
    total: 0,
  };
  if (!season) return empty;

  const [squadResult, toursResult] = await Promise.all([
    db.from("season_clubs").select("clubs(id, name, logo_path)").eq("season_id", season.id),
    db.from("tours").select("id").eq("season_id", season.id),
  ]);
  for (const result of [squadResult, toursResult]) if (result.error) throw result.error;

  const clubs: StandingsClub[] = (squadResult.data ?? []).flatMap((row) => {
    const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;
    return club ? [{ id: club.id, name: club.name, logoUrl: clubLogoUrl(club.logo_path) }] : [];
  });

  const tourIds = (toursResult.data ?? []).map((t) => t.id);
  if (tourIds.length === 0) return { ...empty, rows: computeStandings(clubs, []) };
  const matchesResult = await db
    .from("matches")
    .select("home_club_id, away_club_id, home_score, away_score, status, kickoff_at")
    .in("tour_id", tourIds);
  if (matchesResult.error) throw matchesResult.error;

  const matches: StandingsMatch[] = (matchesResult.data ?? []).map((m) => ({
    homeId: m.home_club_id,
    awayId: m.away_club_id,
    homeScore: m.home_score,
    awayScore: m.away_score,
    status: m.status as StandingsMatch["status"],
    kickoffAt: m.kickoff_at,
  }));
  return {
    ...empty,
    rows: computeStandings(clubs, matches),
    counted: matches.filter(isCounted).length,
    total: matches.filter((m) => m.status !== "cancelled").length,
  };
}
