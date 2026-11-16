import type { SupabaseClient } from "@supabase/supabase-js";
import { attributesOf, weightOf, type Attribute, type Position } from "@/lib/manager/attributes";
import { roundMoney } from "@/lib/manager/economy";
import { errorFields, log } from "@/lib/log";
import type { LineupPlayerSnapshot } from "@/server/api/v1/schemas/manager";
import type { Database, Json, Tables } from "@/types/database";
import { simulateMatch, type Side, type SidePlayer } from "./engine";
import { computeEffects, outcomeOf, type PlayerState } from "./effects";
import { fetchAll } from "../paginate";
import { resolveLineup, toSquad, type SquadPlayer } from "./lineup";

type Db = SupabaseClient<Database>;

const BATCH = 40;
/** At most this many passes in one call: 38 rounds and some room. */
const MAX_PASSES = 120;

function sideOf(
  clubId: string,
  squads: Map<string, SquadPlayer[]>,
  saved: Map<string, Tables<"mgr_lineups">>,
): { side: Side; snapshot: LineupPlayerSnapshot[]; auto: boolean } | null {
  const squad = squads.get(clubId) ?? [];
  const lineup = resolveLineup(squad, saved.get(clubId));
  if (!lineup) return null;
  const byId = new Map(squad.map((p) => [p.id, p]));
  const chosen = lineup.playerIds.map((id) => byId.get(id)!);
  const players: SidePlayer[] = chosen.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    real: p.real,
  }));
  return {
    side: { players, mentality: lineup.mentality },
    snapshot: chosen.map((p) => ({ id: p.id, name: p.name, position: p.position, real: p.real })),
    // The server picked the lineup (no saved one that fits): counted for inactive clubs.
    auto: !lineup.saved,
  };
}

export type PlayerRow = Tables<"mgr_players"> & {
  hidden: { potential: number } | null;
  attrs: { attribute: string; value: number }[] | null;
};

/** What a bot trains: the attribute that matters most for its position and is lowest. */
function botFocus(
  position: Position,
  attributes: Partial<Record<Attribute, number>>,
): Attribute | null {
  const candidates = attributesOf(position).filter((key) => weightOf(position, key) >= 2);
  const lowest = candidates
    .filter((key) => attributes[key] !== undefined)
    .sort((a, b) => attributes[a]! - attributes[b]! || a.localeCompare(b))[0];
  return lowest ?? null;
}

export function toState(row: PlayerRow, isBot: boolean): PlayerState {
  const attributes: Partial<Record<Attribute, number>> = {};
  for (const a of row.attrs ?? []) attributes[a.attribute as Attribute] = a.value;
  const position = row.position as Position;
  const chosen = row.training_focus as Attribute | null;
  return {
    id: row.id,
    position,
    age: row.age,
    ovr: row.ovr,
    form: row.form,
    fitness: row.fitness,
    morale: row.morale,
    idleRounds: row.idle_rounds,
    injuredUntil: row.injured_until ? new Date(row.injured_until) : null,
    // Without a known potential nobody grows.
    potential: row.hidden?.potential ?? row.ovr,
    trainingFocus: isBot ? botFocus(position, attributes) : chosen,
    attributes,
  };
}

/**
 * Plays the matches whose kickoff has passed. Safe to call from several places at once (the
 * scheduler and a visit): the result of a match and its effects on the players are written once,
 * in one transaction, and the same match always comes out the same, because the lineups are
 * locked from kickoff and the draw is seeded by the match. Returns how many matches this call wrote.
 */
export async function playDueMatches(
  admin: Db,
  now: Date = new Date(),
  deadline: number = Infinity,
): Promise<number> {
  // Due = kickoff plus the delay of the league has passed (mgr_due_matches, D-138).
  const due = await admin.rpc("mgr_due_matches", { p_now: now.toISOString(), p_limit: BATCH });
  if (due.error) throw due.error;
  if (!due.data?.length) return 0;

  // A club plays once in a batch: the state a round leaves (form, fitness, injuries, money) is the
  // start of the next one, so the second match of a club waits for the next pass. This matters
  // when several rounds are due at once (after a pause of the scheduler).
  const busy = new Set<string>();
  const batch = due.data.filter((m) => {
    if (busy.has(m.home_club_id) || busy.has(m.away_club_id)) return false;
    busy.add(m.home_club_id);
    busy.add(m.away_club_id);
    return true;
  });

  const clubIds = [...busy];
  const [players, lineups, clubs] = await Promise.all([
    fetchAll<PlayerRow>(
      (from, to) =>
        admin
          .from("mgr_players")
          .select(
            "*, hidden:mgr_player_hidden(potential), attrs:mgr_player_attributes(attribute, value)",
          )
          .in("club_id", clubIds)
          .order("id")
          .range(from, to) as never,
    ),
    fetchAll((from, to) =>
      admin.from("mgr_lineups").select("*").in("club_id", clubIds).order("club_id").range(from, to),
    ),
    admin.from("mgr_clubs").select("id, is_bot, dormant").in("id", clubIds),
  ]);
  if (clubs.error) throw clubs.error;
  // A resting club plays like a bot: picked lineup, automatic training, no money.
  const bots = new Set((clubs.data ?? []).filter((c) => c.is_bot || c.dormant).map((c) => c.id));
  const rowsByClub = new Map<string, PlayerRow[]>();
  for (const player of players) {
    if (!player.club_id) continue;
    rowsByClub.set(player.club_id, [...(rowsByClub.get(player.club_id) ?? []), player]);
  }
  const saved = new Map(lineups.filter((l) => !bots.has(l.club_id)).map((l) => [l.club_id, l]));

  let written = 0;
  for (const match of batch) {
    if (Date.now() > deadline) break;
    const kickoff = new Date(match.kickoff_at);
    const rows = {
      home: rowsByClub.get(match.home_club_id) ?? [],
      away: rowsByClub.get(match.away_club_id) ?? [],
    };
    const squads = new Map<string, SquadPlayer[]>([
      [match.home_club_id, toSquad(rows.home, kickoff)],
      [match.away_club_id, toSquad(rows.away, kickoff)],
    ]);
    const home = sideOf(match.home_club_id, squads, saved);
    const away = sideOf(match.away_club_id, squads, saved);
    if (!home || !away) {
      log("warn", "manager.match_skipped", { match: match.id });
      continue;
    }
    const result = simulateMatch(match.id, home.side, away.side);

    const effects = (["home", "away"] as const).flatMap((side) => {
      const clubId = side === "home" ? match.home_club_id : match.away_club_id;
      const own = side === "home" ? result.homeGoals : result.awayGoals;
      const other = side === "home" ? result.awayGoals : result.homeGoals;
      const lineup = side === "home" ? home : away;
      return computeEffects({
        mode: match.kind === "friendly" ? "friendly" : "league",
        seed: `${match.id}:${side}`,
        kickoff,
        players: rows[side].map((row) => toState(row, bots.has(clubId))),
        played: new Set(lineup.snapshot.map((p) => p.id)),
        outcome: outcomeOf(own, other),
        injuries: new Map(
          result.injuries.filter((i) => i.side === side).map((i) => [i.playerId, i.days]),
        ),
      });
    });

    // The money of a round of the league (a friendly pays nothing); bots keep no purse.
    const money = (["home", "away"] as const).flatMap((side) => {
      const clubId = side === "home" ? match.home_club_id : match.away_club_id;
      if (match.kind === "friendly" || bots.has(clubId)) return [];
      const own = side === "home" ? result.homeGoals : result.awayGoals;
      const other = side === "home" ? result.awayGoals : result.homeGoals;
      return roundMoney({
        home: side === "home",
        outcome: outcomeOf(own, other),
        squad: rows[side].map((row) => ({ ovr: row.ovr, age: row.age, wage: row.wage })),
      }).map((entry) => ({ club_id: clubId, reason: entry.reason, amount: entry.amount }));
    });

    const { data, error } = await admin.rpc("mgr_play_match_v3", {
      p_match: match.id,
      p_home_goals: result.homeGoals,
      p_away_goals: result.awayGoals,
      p_events: result.events as unknown as Json,
      p_home_lineup: home.snapshot as unknown as Json,
      p_away_lineup: away.snapshot as unknown as Json,
      p_effects: effects as unknown as Json,
      p_money: money as unknown as Json,
      p_home_auto: home.auto && !bots.has(match.home_club_id),
      p_away_auto: away.auto && !bots.has(match.away_club_id),
    });
    if (error) {
      log("error", "manager.match_failed", { match: match.id, ...errorFields(error) });
      continue;
    }
    if (data) written += 1;
  }
  return written;
}

/** Plays everything that is due, batch after batch (the scheduler calls this). */
export async function playAllDue(
  admin: Db,
  now: Date = new Date(),
  deadline: number = Infinity,
): Promise<number> {
  let total = 0;
  // Passes go on while they make progress: a long pause leaves many rounds, one per pass for a club.
  for (let i = 0; i < MAX_PASSES; i += 1) {
    if (Date.now() > deadline) break;
    const written = await playDueMatches(admin, now, deadline);
    total += written;
    if (written === 0) break;
  }
  return total;
}
