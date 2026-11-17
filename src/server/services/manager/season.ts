import type { SupabaseClient } from "@supabase/supabase-js";
import type { Position } from "@/lib/manager/attributes";
import { errorFields, log } from "@/lib/log";
import { buildSchedule } from "@/lib/manager/schedule";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type { Database, Json } from "@/types/database";
import { fetchAll } from "../paginate";
import { computePreseasonDay } from "./effects";
import { playAllDue, toState, type PlayerRow } from "./league";
import { listPoolLots, settleDueAuctions } from "./auction";
import { releaseExpiredContracts } from "./contracts";
import { runMarketPools } from "./market";
import { makeRandom } from "./random";
import { generateYouth } from "./squad";
import { expireTrades } from "./trade";

type Db = SupabaseClient<Database>;

const DAY_MS = 86_400_000;
/** How many preseason days one call catches up on (a long outage must not run away). */
const MAX_DAYS_PER_CALL = 8;
/** How long one call of runRounds may work before it leaves the rest to the next call (D-138). */
export const RUN_BUDGET_MS = 22_000;

async function clubsOf(admin: Db, leagueId: string) {
  const { data, error } = await admin
    .from("mgr_clubs")
    .select("id, is_bot, dormant")
    .eq("league_id", leagueId);
  if (error) throw error;
  return data ?? [];
}

async function idsOf(
  admin: Db,
  fn: "mgr_leagues_to_close" | "mgr_leagues_to_open",
): Promise<string[]> {
  const { data, error } = await admin.rpc(fn);
  if (error) throw error;
  return (data as string[] | null) ?? [];
}

/**
 * Ends the season of every league whose 38th round has been played: the players who retire are
 * replaced by young players of the same position from the academy (so that a squad does not melt
 * away before the market exists), everyone gets a year older, and the preseason begins.
 */
export async function closeFinishedSeasons(admin: Db): Promise<number> {
  let closed = 0;
  for (const leagueId of await idsOf(admin, "mgr_leagues_to_close")) {
    const league = await admin
      .from("mgr_leagues")
      .select("season")
      .eq("id", leagueId)
      .maybeSingle();
    if (league.error) throw league.error;
    const clubIds = (await clubsOf(admin, leagueId)).map((c) => c.id);
    const retirees = await fetchAll((from, to) =>
      admin
        .from("mgr_players")
        .select("id, club_id, position")
        .in("club_id", clubIds)
        .eq("retire_after_season", true)
        .order("id")
        .range(from, to),
    );
    const replacements = retirees.map((player) => {
      const youth = generateYouth(
        `${leagueId}:${league.data?.season ?? 0}:${player.id}`,
        player.position as Position,
        "BY",
      );
      return {
        club_id: player.club_id,
        position: youth.position,
        first_name: youth.firstName,
        last_name: youth.lastName,
        age: youth.age,
        ovr: youth.ovr,
        potential: youth.potential,
        attributes: youth.attributes,
      };
    });
    const { data, error } = await admin.rpc("mgr_close_season", {
      p_league: leagueId,
      p_replacements: replacements as unknown as Json,
    });
    if (error) {
      log("error", "manager.close_season_failed", { leagueId, ...errorFields(error) });
      continue;
    }
    if (data) closed += 1;
  }
  return closed;
}

/** One day of the preseason for every league that is in it: rest, and training at half strength. */
export async function runPreseasonDays(admin: Db, now: Date = new Date()): Promise<number> {
  const leagues = await admin
    .from("mgr_leagues")
    .select("id, last_tick_at, preseason_ends_at")
    .eq("phase", "preseason");
  if (leagues.error) throw leagues.error;

  let applied = 0;
  for (const league of leagues.data ?? []) {
    if (!league.last_tick_at || !league.preseason_ends_at) continue;
    const ends = new Date(league.preseason_ends_at).getTime();
    let day = new Date(new Date(league.last_tick_at).getTime() + DAY_MS);
    const clubs = await clubsOf(admin, league.id);
    const bots = new Set(clubs.filter((c) => c.is_bot || c.dormant).map((c) => c.id));

    for (
      let i = 0;
      i < MAX_DAYS_PER_CALL && day.getTime() <= now.getTime() && day.getTime() < ends;
      i += 1
    ) {
      const players = await fetchAll<PlayerRow>(
        (from, to) =>
          admin
            .from("mgr_players")
            .select(
              "*, hidden:mgr_player_hidden(potential), attrs:mgr_player_attributes(attribute, value)",
            )
            .in(
              "club_id",
              clubs.map((c) => c.id),
            )
            .order("id")
            .range(from, to) as never,
      );
      const effects = computePreseasonDay({
        seed: `${league.id}:${day.toISOString()}`,
        day,
        players: players.map((row) => toState(row, bots.has(row.club_id ?? ""))),
      });
      const { data, error } = await admin.rpc("mgr_apply_preseason_day", {
        p_league: league.id,
        p_day: day.toISOString(),
        p_effects: effects as unknown as Json,
      });
      if (error) {
        log("error", "manager.preseason_day_failed", { league: league.id, ...errorFields(error) });
        break;
      }
      if (data) applied += 1;
      day = new Date(day.getTime() + DAY_MS);
    }
  }
  return applied;
}

/** Starts the next season of every league whose preseason is over, with a new draw of the schedule. */
export async function openReadySeasons(admin: Db): Promise<number> {
  let opened = 0;
  for (const leagueId of await idsOf(admin, "mgr_leagues_to_open")) {
    const league = await admin
      .from("mgr_leagues")
      .select("season")
      .eq("id", leagueId)
      .maybeSingle();
    if (league.error) throw league.error;
    const clubs = (await clubsOf(admin, leagueId)).map((c) => c.id).sort();
    if (clubs.length !== 20) {
      log("error", "manager.season_clubs", { leagueId, clubs: clubs.length });
      continue;
    }
    // The clubs take their numbers in a new order each season, so who meets whom at home changes.
    const random = makeRandom(`${leagueId}:${league.data?.season ?? 0}:draw`);
    const order = [...clubs];
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const matches = buildSchedule().map((f) => ({
      round: f.round,
      home_club_id: order[f.home]!,
      away_club_id: order[f.away]!,
    }));
    const { data, error } = await admin.rpc("mgr_open_season", {
      p_league: leagueId,
      p_matches: matches as unknown as Json,
    });
    if (error) {
      log("error", "manager.open_season_failed", { leagueId, ...errorFields(error) });
      continue;
    }
    if (data) opened += 1;
  }
  return opened;
}

/**
 * Everything the scheduler does: plays the matches that are due, and moves the leagues through the
 * end of the season, the preseason days and the start of the next season. Safe to call from
 * several places at once: every step is written once by the database.
 */
export async function runRounds(
  admin: Db,
  now: Date = new Date(),
  budgetMs: number = RUN_BUDGET_MS,
): Promise<{
  played: number;
  closed: number;
  days: number;
  opened: number;
  pools: number;
  released: number;
  settled: number;
  expired: number;
  /** True when the time budget ran out: the next call goes on. */
  partial: boolean;
}> {
  const deadline = Date.now() + budgetMs;
  const played = await playAllDue(admin, now, deadline);
  if (Date.now() > deadline) {
    // Matches first: the steps after them wait for the next call (the order is kept).
    return {
      played,
      closed: 0,
      days: 0,
      opened: 0,
      pools: 0,
      released: 0,
      settled: 0,
      expired: 0,
      partial: true,
    };
  }
  const closed = await closeFinishedSeasons(admin);
  const days = await runPreseasonDays(admin, now);
  const opened = await openReadySeasons(admin);
  const pools = await runMarketPools(admin, now);
  // The market (D-136): contracts that are over, the lots whose tick has come, the offers out of time.
  const released = await releaseExpiredContracts(admin);
  const settled = await settleDueAuctions(admin);
  await listPoolLots(admin);
  const expired = await expireTrades(admin);
  return { played, closed, days, opened, pools, released, settled, expired, partial: false };
}

/** A friendly match with a random club of the league, at the next 10:00 Moscow time. */
export async function requestFriendly(admin: Db, userId: string): Promise<{ matchId: string }> {
  const { data, error } = await admin.rpc("mgr_request_friendly", { p_user: userId });
  if (!error && data) return { matchId: data };
  const message = error?.message ?? "";
  if (message.includes("manager.friendly_unavailable")) {
    throw new ApiError(
      409,
      ERROR_CODES.managerFriendlyUnavailable,
      "Conflict",
      "Friendly matches are played in the preseason only.",
    );
  }
  if (message.includes("manager.friendly_busy")) {
    throw new ApiError(
      409,
      ERROR_CODES.managerFriendlyBusy,
      "Conflict",
      "No club is free for a friendly on that day.",
    );
  }
  if (message.includes("manager.club_unknown")) {
    throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "You have no club yet.");
  }
  throw error ?? new Error("friendly was not created");
}
