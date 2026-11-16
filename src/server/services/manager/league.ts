import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attributesOf,
  realRating,
  weightOf,
  type Attribute,
  type Position,
} from "@/lib/manager/attributes";
import {
  autoLineup,
  lineupFits,
  type Formation,
  type Mentality,
  type RatedPlayer,
} from "@/lib/manager/formations";
import { CLUB_COLORS, FALLBACK_COLORS } from "@/lib/manager/palette";
import { buildSchedule, firstKickoff, ROUNDS } from "@/lib/manager/schedule";
import { roundMoney } from "@/lib/manager/economy";
import { computeTable } from "@/lib/manager/table";
import { errorFields, log } from "@/lib/log";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type {
  LeagueView,
  LineupBody,
  LineupPlayerSnapshot,
  LineupView,
  TrainingBody,
  MatchDetail,
  MatchEventData,
  MatchList,
  MatchSummary,
} from "@/server/api/v1/schemas/manager";
import type { Database, Json, Tables } from "@/types/database";
import { simulateMatch, type Side, type SidePlayer } from "./engine";
import { computeEffects, outcomeOf, type PlayerState } from "./effects";
import { generateSquad } from "./squad";
import { fetchAll } from "../paginate";
import { makeRandom } from "./random";

type Db = SupabaseClient<Database>;

type ClubBit = {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
};
type MatchRow = Tables<"mgr_matches"> & { home: ClubBit | null; away: ClubBit | null };

const MATCH_SELECT =
  "*, home:mgr_clubs!mgr_matches_home_club_id_fkey(id, name, primary_color, secondary_color), away:mgr_clubs!mgr_matches_away_club_id_fkey(id, name, primary_color, secondary_color)";

const toSide = (club: ClubBit | null, fallbackId: string) => ({
  clubId: club?.id ?? fallbackId,
  name: club?.name ?? "",
  primaryColor: club?.primary_color ?? FALLBACK_COLORS.primary,
  secondaryColor: club?.secondary_color ?? FALLBACK_COLORS.secondary,
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

async function myClubId(
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
      .select("id, name, primary_color, secondary_color, is_bot")
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
        isBot: c?.is_bot ?? false,
        isMine: row.clubId === club.id,
      };
    }),
  };
}

// ---- lineups -------------------------------------------------------------------------------

type SquadPlayer = RatedPlayer & { name: string; injured: boolean };

function toSquad(rows: Tables<"mgr_players">[], at: Date): SquadPlayer[] {
  return rows.map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`,
    position: p.position as Position,
    real: realRating(p.ovr, { form: p.form, fitness: p.fitness, morale: p.morale }),
    injured: p.injured_until !== null && new Date(p.injured_until).getTime() > at.getTime(),
  }));
}

type ChosenLineup = {
  formation: Formation;
  mentality: Mentality;
  playerIds: string[];
  saved: boolean;
};

/**
 * The saved lineup when it still fits the squad, otherwise the best one (no penalty). An injured
 * player of the saved lineup is replaced by the best fit player of the same position, so one
 * injury does not throw away the whole choice.
 */
export function resolveLineup(
  squad: SquadPlayer[],
  saved: Pick<Tables<"mgr_lineups">, "formation" | "mentality" | "player_ids"> | null | undefined,
): ChosenLineup | null {
  const fit = squad.filter((p) => !p.injured);
  if (saved) {
    const byId = new Map(squad.map((p) => [p.id, p]));
    const chosen = saved.player_ids.map((id) => byId.get(id));
    if (chosen.every((p): p is SquadPlayer => Boolean(p))) {
      const taken = new Set(chosen.map((p) => p.id));
      const lineup: SquadPlayer[] = [];
      let replaced = true;
      for (const player of chosen) {
        if (!player.injured) {
          lineup.push(player);
          continue;
        }
        const substitute = fit
          .filter((p) => p.position === player.position && !taken.has(p.id))
          .sort((a, b) => b.real - a.real || a.id.localeCompare(b.id))[0];
        if (!substitute) {
          replaced = false;
          break;
        }
        taken.add(substitute.id);
        lineup.push(substitute);
      }
      if (replaced && lineupFits(saved.formation as Formation, lineup)) {
        return {
          formation: saved.formation as Formation,
          mentality: saved.mentality as Mentality,
          playerIds: lineup.map((p) => p.id),
          saved: true,
        };
      }
    }
  }
  // A league must never stall: when too many are hurt for any formation, the hurt play too.
  const auto = autoLineup(fit) ?? autoLineup(squad);
  return auto ? { ...auto, saved: false } : null;
}

export async function getLineup(supabase: Db, userId: string): Promise<LineupView> {
  const club = await myClubId(supabase, userId);
  const [players, saved, next] = await Promise.all([
    supabase.from("mgr_players").select("*").eq("club_id", club.id),
    supabase.from("mgr_lineups").select("*").eq("club_id", club.id).maybeSingle(),
    supabase
      .from("mgr_matches")
      .select("kickoff_at")
      .or(`home_club_id.eq.${club.id},away_club_id.eq.${club.id}`)
      .eq("status", "scheduled")
      .order("round")
      .limit(1)
      .maybeSingle(),
  ]);
  if (players.error) throw players.error;
  if (saved.error) throw saved.error;
  if (next.error) throw next.error;

  const lineup = resolveLineup(toSquad(players.data ?? [], new Date()), saved.data);
  if (!lineup) throw new Error("the squad cannot field a lineup");
  const nextKickoff = next.data ? new Date(next.data.kickoff_at) : null;
  return {
    formation: lineup.formation,
    mentality: lineup.mentality,
    playerIds: lineup.playerIds,
    saved: lineup.saved,
    locked: nextKickoff !== null && nextKickoff.getTime() <= Date.now(),
    nextKickoffAt: nextKickoff ? nextKickoff.toISOString() : null,
  };
}

/** Saves the lineup; the database checks the squad, the formation and that no round is due yet. */
export async function saveLineup(admin: Db, userId: string, body: LineupBody): Promise<void> {
  const { error } = await admin.rpc("mgr_save_lineup", {
    p_user: userId,
    p_formation: body.formation,
    p_mentality: body.mentality,
    p_players: body.playerIds,
  });
  if (!error) return;
  if (error.message.includes("manager.lineup_locked")) {
    throw new ApiError(
      409,
      ERROR_CODES.managerLineupLocked,
      "Conflict",
      "The round has started: the lineup can no longer be changed.",
    );
  }
  if (error.message.includes("manager.lineup_invalid")) {
    throw new ApiError(
      422,
      ERROR_CODES.validationFailed,
      "Unprocessable Content",
      "The lineup does not fit the formation.",
      [{ field: "playerIds", message: "Choose 1 goalkeeper and the players the formation needs." }],
    );
  }
  if (error.message.includes("manager.club_unknown")) {
    throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "You have no club yet.");
  }
  throw error;
}

// ---- leagues -------------------------------------------------------------------------------

const BOT_SUFFIXES = [
  "Сокол",
  "Вымпел",
  "Гранит",
  "Метеор",
  "Ураган",
  "Маяк",
  "Орбита",
  "Прибой",
  "Рассвет",
  "Таран",
  "Факел",
  "Янтарь",
  "Ястреб",
  "Бастион",
  "Атлант",
  "Зубр",
];

/** 20 bot clubs with squads of the same kind as everyone's. */
function makeBots(cities: { id: number; name: string }[]) {
  const random = makeRandom(randomBytes(16).toString("hex"));
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
  return Array.from({ length: 20 }, () => {
    const seed = randomBytes(16).toString("hex");
    const city = pick(cities);
    const primary = pick(CLUB_COLORS);
    const secondary = pick(CLUB_COLORS.filter((c) => c !== primary));
    return {
      name: `${pick(BOT_SUFFIXES)} ${city.name}`,
      city_id: city.id,
      primary_color: primary,
      secondary_color: secondary,
      seed,
      players: generateSquad(seed, "BY").map((p) => ({
        first_name: p.firstName,
        last_name: p.lastName,
        position: p.position,
        age: p.age,
        potential: p.potential,
        ovr: p.ovr,
        attributes: p.attributes,
      })),
    };
  });
}

/**
 * Puts a club that has no league into one: the place of a bot of an existing league, or a new
 * league of 20 bots (made in one transaction together with the club's place in it).
 */
export async function placeClub(admin: Db, clubId: string): Promise<string> {
  const joined = await admin.rpc("mgr_join_league", { p_club: clubId });
  if (joined.error) throw joined.error;
  if (joined.data) return joined.data;

  const { data: cities, error } = await admin.from("mgr_cities").select("id, name");
  if (error) throw error;
  const opened = await admin.rpc("mgr_open_league", {
    p_club: clubId,
    p_first_kickoff: firstKickoff(new Date()).toISOString(),
    p_bots: makeBots(cities ?? []) as unknown as Json,
    p_matches: buildSchedule() as unknown as Json,
  });
  if (opened.error) throw opened.error;
  return opened.data;
}

// ---- playing the rounds --------------------------------------------------------------------

const BATCH = 40;

function sideOf(
  clubId: string,
  squads: Map<string, SquadPlayer[]>,
  saved: Map<string, Tables<"mgr_lineups">>,
): { side: Side; snapshot: LineupPlayerSnapshot[] } | null {
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
export async function playDueMatches(admin: Db, now: Date = new Date()): Promise<number> {
  const due = await admin
    .from("mgr_matches")
    .select("id, kickoff_at, kind, home_club_id, away_club_id")
    .eq("status", "scheduled")
    .lte("kickoff_at", now.toISOString())
    .order("kickoff_at")
    .order("id")
    .limit(BATCH);
  if (due.error) throw due.error;
  if (!due.data?.length) return 0;

  const clubIds = [...new Set(due.data.flatMap((m) => [m.home_club_id, m.away_club_id]))];
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
    admin.from("mgr_clubs").select("id, is_bot").in("id", clubIds),
  ]);
  if (clubs.error) throw clubs.error;
  const bots = new Set((clubs.data ?? []).filter((c) => c.is_bot).map((c) => c.id));
  const rowsByClub = new Map<string, PlayerRow[]>();
  for (const player of players) {
    if (!player.club_id) continue;
    rowsByClub.set(player.club_id, [...(rowsByClub.get(player.club_id) ?? []), player]);
  }
  const saved = new Map(lineups.map((l) => [l.club_id, l]));

  let written = 0;
  for (const match of due.data) {
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
        squad: rows[side].map((row) => ({ ovr: row.ovr, age: row.age })),
      }).map((entry) => ({ club_id: clubId, reason: entry.reason, amount: entry.amount }));
    });

    const { data, error } = await admin.rpc("mgr_play_match_v2", {
      p_match: match.id,
      p_home_goals: result.homeGoals,
      p_away_goals: result.awayGoals,
      p_events: result.events as unknown as Json,
      p_home_lineup: home.snapshot as unknown as Json,
      p_away_lineup: away.snapshot as unknown as Json,
      p_effects: effects as unknown as Json,
      p_money: money as unknown as Json,
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
export async function playAllDue(admin: Db, now: Date = new Date()): Promise<number> {
  let total = 0;
  for (let i = 0; i < 20; i += 1) {
    const written = await playDueMatches(admin, now);
    total += written;
    if (written === 0 || written < BATCH) break;
  }
  return total;
}

/** Sets what the players train; the database checks the club, the attributes and that no round is due. */
export async function saveTraining(admin: Db, userId: string, body: TrainingBody): Promise<void> {
  const { error } = await admin.rpc("mgr_set_training", {
    p_user: userId,
    p_plans: body.plans.map((p) => ({ player_id: p.playerId, focus: p.focus })) as unknown as Json,
  });
  if (!error) return;
  if (error.message.includes("manager.training_locked")) {
    throw new ApiError(
      409,
      ERROR_CODES.managerTrainingLocked,
      "Conflict",
      "The round has started: training can no longer be changed.",
    );
  }
  if (error.message.includes("manager.training_invalid")) {
    throw new ApiError(
      422,
      ERROR_CODES.validationFailed,
      "Unprocessable Content",
      "The training plan is not valid.",
      [{ field: "plans", message: "Choose players of your club and attributes they have." }],
    );
  }
  if (error.message.includes("manager.club_unknown")) {
    throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "You have no club yet.");
  }
  throw error;
}
