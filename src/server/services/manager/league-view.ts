import type { SupabaseClient } from "@supabase/supabase-js";
import { FALLBACK_COLORS } from "@/lib/manager/palette";
import { ROUNDS } from "@/lib/manager/schedule";
import { managerLogoUrl } from "@/lib/manager/logo-url";
import { computeTable } from "@/lib/manager/table";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type {
  LeagueView,
  LineupPlayerSnapshot,
  MatchDetail,
  MatchEventData,
  MatchList,
  MatchSummary,
} from "@/server/api/v1/schemas/manager";
import type { Database, Tables } from "@/types/database";
import { fetchAll } from "../paginate";

type Db = SupabaseClient<Database>;

type ClubBit = {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  logo_path: string | null;
};
type MatchRow = Tables<"mgr_matches"> & { home: ClubBit | null; away: ClubBit | null };

const MATCH_SELECT =
  "*, home:mgr_clubs!mgr_matches_home_club_id_fkey(id, name, primary_color, secondary_color, logo_path), away:mgr_clubs!mgr_matches_away_club_id_fkey(id, name, primary_color, secondary_color, logo_path)";

const toSide = (club: ClubBit | null, fallbackId: string) => ({
  clubId: club?.id ?? fallbackId,
  name: club?.name ?? "",
  primaryColor: club?.primary_color ?? FALLBACK_COLORS.primary,
  secondaryColor: club?.secondary_color ?? FALLBACK_COLORS.secondary,
  logoUrl: managerLogoUrl(club?.logo_path),
});

export function toMatchSummary(row: MatchRow): MatchSummary {
  return {
    id: row.id,
    round: row.round,
    kickoffAt: new Date(row.kickoff_at).toISOString(),
    status: row.status as MatchSummary["status"],
    kind: row.kind as MatchSummary["kind"],
    home: toSide(row.home, row.home_club_id),
    away: toSide(row.away, row.away_club_id),
    homeGoals: row.home_goals,
    awayGoals: row.away_goals,
  };
}

export async function myClubId(
  supabase: Db,
  userId: string,
): Promise<{ id: string; leagueId: string | null }> {
  const { data, error } = await supabase
    .from("mgr_clubs")
    .select("id, league_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "You have no club yet.");
  return { id: data.id, leagueId: data.league_id };
}

/** The next match of a club that has not been played yet, or null. */
export async function getNextMatch(supabase: Db, clubId: string): Promise<MatchSummary | null> {
  const { data, error } = await supabase
    .from("mgr_matches")
    .select(MATCH_SELECT)
    .or(`home_club_id.eq.${clubId},away_club_id.eq.${clubId}`)
    .eq("status", "scheduled")
    .order("kickoff_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toMatchSummary(data as unknown as MatchRow) : null;
}

export async function listMyMatches(supabase: Db, userId: string): Promise<MatchList> {
  const club = await myClubId(supabase, userId);
  if (!club.leagueId) return { matches: [] };
  const league = await supabase
    .from("mgr_leagues")
    .select("season")
    .eq("id", club.leagueId)
    .maybeSingle();
  if (league.error) throw league.error;
  const { data, error } = await supabase
    .from("mgr_matches")
    .select(MATCH_SELECT)
    .or(`home_club_id.eq.${club.id},away_club_id.eq.${club.id}`)
    .eq("season", league.data?.season ?? 1)
    .order("kickoff_at")
    .order("round");
  if (error) throw error;
  return { matches: (data ?? []).map((row) => toMatchSummary(row as unknown as MatchRow)) };
}

/** A match of my league with its chronicle (RLS lets a user see the matches of their league only). */
export async function getMatch(supabase: Db, matchId: string): Promise<MatchDetail> {
  const { data, error } = await supabase
    .from("mgr_matches")
    .select(MATCH_SELECT)
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "Match not found.");
  const row = data as unknown as MatchRow;
  return {
    ...toMatchSummary(row),
    events: (row.events as MatchEventData[] | null) ?? [],
    homeLineup: (row.home_lineup as LineupPlayerSnapshot[] | null) ?? null,
    awayLineup: (row.away_lineup as LineupPlayerSnapshot[] | null) ?? null,
  };
}

/** The table of the league of the caller's club, from the matches played so far. */
export async function getLeagueView(supabase: Db, userId: string): Promise<LeagueView> {
  const club = await myClubId(supabase, userId);
  if (!club.leagueId) return { league: null, table: [] };

  const league = await supabase
    .from("mgr_leagues")
    .select("*")
    .eq("id", club.leagueId)
    .maybeSingle();
  if (league.error) throw league.error;
  if (!league.data) return { league: null, table: [] };
  const season = league.data.season;

  const [clubs, matches] = await Promise.all([
    supabase
      .from("mgr_clubs")
      .select("id, name, primary_color, secondary_color, is_bot, logo_path")
      .eq("league_id", club.leagueId),
    fetchAll((from, to) =>
      supabase
        .from("mgr_matches")
        .select("id, round, status, home_club_id, away_club_id, home_goals, away_goals")
        .eq("league_id", club.leagueId!)
        .eq("season", season)
        .eq("kind", "league")
        .order("id")
        .range(from, to),
    ),
  ]);
  if (clubs.error) throw clubs.error;

  const finished = matches.filter((m) => m.status === "finished");
  const rows = computeTable(
    (clubs.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    finished.map((m) => ({
      homeClubId: m.home_club_id,
      awayClubId: m.away_club_id,
      homeGoals: m.home_goals ?? 0,
      awayGoals: m.away_goals ?? 0,
    })),
  );
  const info = new Map((clubs.data ?? []).map((c) => [c.id, c]));

  // A round counts as played when all 10 of its matches are finished.
  const perRound = new Map<number, { total: number; done: number }>();
  for (const m of matches) {
    const entry = perRound.get(m.round) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (m.status === "finished") entry.done += 1;
    perRound.set(m.round, entry);
  }
  const roundsPlayed = [...perRound.values()].filter((r) => r.done === r.total).length;

  return {
    league: {
      id: league.data.id,
      number: league.data.number,
      season: league.data.season,
      firstKickoffAt: new Date(league.data.first_kickoff_at).toISOString(),
      roundsPlayed,
      rounds: ROUNDS,
      phase: league.data.phase as "season" | "preseason",
      preseasonEndsAt: league.data.preseason_ends_at
        ? new Date(league.data.preseason_ends_at).toISOString()
        : null,
    },
    table: rows.map((row) => {
      const c = info.get(row.clubId);
      return {
        ...row,
        name: c?.name ?? "",
        primaryColor: c?.primary_color ?? FALLBACK_COLORS.primary,
        secondaryColor: c?.secondary_color ?? FALLBACK_COLORS.secondary,
        logoUrl: managerLogoUrl(c?.logo_path),
        isBot: c?.is_bot ?? false,
        isMine: row.clubId === club.id,
      };
    }),
  };
}
