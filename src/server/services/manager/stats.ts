import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type { PlayerStats, Scorers, StatLine } from "@/server/api/v1/schemas/manager-stats";
import type { Database, Tables } from "@/types/database";
import { memberClub } from "./auction";

type Db = SupabaseClient<Database>;
type Position = PlayerStats["position"];
type StatRow = Pick<
  Tables<"mgr_player_stats">,
  "matches" | "goals" | "assists" | "shots" | "shots_on_target" | "injuries" | "clean_sheets"
>;

/** How many players the scorers page shows. */
export const SCORERS_LIMIT = 30;

export function toStatLine(row: StatRow): StatLine {
  return {
    matches: row.matches,
    goals: row.goals,
    assists: row.assists,
    shots: row.shots,
    shotsOnTarget: row.shots_on_target,
    injuries: row.injuries,
    cleanSheets: row.clean_sheets,
  };
}

export function sumLines(lines: StatLine[]): StatLine {
  return lines.reduce<StatLine>(
    (sum, l) => ({
      matches: sum.matches + l.matches,
      goals: sum.goals + l.goals,
      assists: sum.assists + l.assists,
      shots: sum.shots + l.shots,
      shotsOnTarget: sum.shotsOnTarget + l.shotsOnTarget,
      injuries: sum.injuries + l.injuries,
      cleanSheets: sum.cleanSheets + l.cleanSheets,
    }),
    { matches: 0, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, injuries: 0, cleanSheets: 0 },
  );
}

/**
 * The statistics of a player of my league (my own or of another club). Read with the service role
 * after the league is checked: RLS hides the players of other clubs from the caller, but the
 * statistics of a league are open inside it.
 */
export async function getPlayerStats(
  admin: Db,
  userId: string,
  playerId: string,
): Promise<PlayerStats> {
  const me = await memberClub(admin, userId);
  const notFound = () => new ApiError(404, ERROR_CODES.notFound, "Not Found", "Player not found.");
  const player = await admin
    .from("mgr_players")
    .select("id, first_name, last_name, position, club_id")
    .eq("id", playerId)
    .maybeSingle();
  if (player.error) throw player.error;
  if (!player.data || !me.league_id) throw notFound();

  // The player must be of a club of my league (a free agent has no club: not found).
  const club = player.data.club_id
    ? await admin.from("mgr_clubs").select("league_id").eq("id", player.data.club_id).maybeSingle()
    : null;
  if (club?.error) throw club.error;
  if (!club?.data || club.data.league_id !== me.league_id) throw notFound();

  const rows = await admin
    .from("mgr_player_stats")
    .select("*, club:mgr_clubs(name)")
    .eq("player_id", playerId)
    .eq("league_id", me.league_id)
    .order("season", { ascending: false });
  if (rows.error) throw rows.error;
  const seasons = (rows.data ?? []).map((row) => ({
    ...toStatLine(row),
    season: row.season,
    clubName: (row.club as { name: string } | null)?.name ?? "",
  }));
  return {
    playerId,
    name: `${player.data.first_name} ${player.data.last_name}`,
    position: player.data.position as Position,
    seasons,
    career: sumLines(seasons),
  };
}

/** The top scorers (then assists) of my league in its current season. */
export async function getScorers(admin: Db, userId: string): Promise<Scorers> {
  const me = await memberClub(admin, userId);
  if (!me.league_id) return { season: null, scorers: [] };
  const league = await admin
    .from("mgr_leagues")
    .select("season")
    .eq("id", me.league_id)
    .maybeSingle();
  if (league.error) throw league.error;
  const season = league.data?.season ?? 1;
  const { data, error } = await admin
    .from("mgr_player_stats")
    .select("*, player:mgr_players(first_name, last_name, position), club:mgr_clubs(id, name)")
    .eq("league_id", me.league_id)
    .eq("season", season)
    .gt("goals", 0)
    .order("goals", { ascending: false })
    .order("assists", { ascending: false })
    .order("matches", { ascending: true })
    .order("player_id")
    .limit(SCORERS_LIMIT);
  if (error) throw error;
  return {
    season,
    scorers: (data ?? []).flatMap((row) => {
      const player = row.player as {
        first_name: string;
        last_name: string;
        position: string;
      } | null;
      const club = row.club as { id: string; name: string } | null;
      if (!player || !club) return [];
      return [
        {
          ...toStatLine(row),
          playerId: row.player_id,
          name: `${player.first_name} ${player.last_name}`,
          position: player.position as Position,
          clubId: club.id,
          clubName: club.name,
          isMine: club.id === me.id,
        },
      ];
    }),
  };
}
