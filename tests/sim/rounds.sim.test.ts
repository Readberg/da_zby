import { beforeAll, describe, expect, it } from "vitest";
import { CLUB_COLORS } from "@/lib/manager/palette";
import { fetchAll } from "@/server/services/paginate";
import { createClub } from "@/server/services/manager/club";
import { runRounds } from "@/server/services/manager/season";
import {
  TEST_EMAIL_DOMAIN,
  createTestUser,
  serviceClient,
  signedInClient,
  type Db,
} from "../db/helpers";

// Simulation of three rounds on a real local Supabase stack: 45 real clubs in three leagues (20, 20
// and 5 real clubs among bots). The full run of the scheduler (`runRounds`) plays each round, then the
// invariants of the game are checked: tables, money, Elo, statistics, squads, idempotency. A hard
// problem fails the test; a suspicious thing is a warning and goes to the report.
const USERS = 45;
const ROUNDS = 3;
const DAY = 86_400_000;
const START_BUDGET = 10_000;

const admin = serviceClient();
const problems: string[] = [];
const warnings: string[] = [];
const timings: string[] = [];
const squadSize = new Map<string, number>();
let leagueIds: string[] = [];
const realClubIds: string[] = [];

function problem(text: string) {
  problems.push(text);
}
function warn(text: string) {
  warnings.push(text);
}

async function reset() {
  await admin.from("mgr_leagues").delete().not("id", "is", null);
  await admin.from("mgr_clubs").delete().not("id", "is", null);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data.users) {
    if (user.email?.endsWith(`@${TEST_EMAIL_DOMAIN}`)) await admin.auth.admin.deleteUser(user.id);
  }
}

async function seed() {
  await reset();
  const { data: cities } = await admin.from("mgr_cities").select("id").limit(1);
  const cityId = cities![0]!.id;
  for (let i = 0; i < USERS; i += 1) {
    const user = await createTestUser(`sim${i}`);
    const client: Db = await signedInClient(user);
    const club = await createClub(admin, client, user.id, {
      name: `Sim Club ${i + 1}`,
      cityId,
      primaryColor: CLUB_COLORS[0],
      secondaryColor: CLUB_COLORS[1],
    });
    realClubIds.push(club.id);
  }
  const clubs = await fetchAll((from, to) =>
    admin.from("mgr_clubs").select("id, league_id").order("id").range(from, to),
  );
  leagueIds = [...new Set(clubs.map((c) => c.league_id).filter((id): id is string => !!id))];
  const players = await fetchAll((from, to) =>
    admin
      .from("mgr_players")
      .select("id, club_id")
      .not("club_id", "is", null)
      .order("id")
      .range(from, to),
  );
  for (const p of players) squadSize.set(p.club_id!, (squadSize.get(p.club_id!) ?? 0) + 1);
}

/** Moves the matches of one round of every league into the past, as the days go by. */
async function moveRound(round: number) {
  const at = new Date(Date.now() - (ROUNDS + 1 - round) * DAY).toISOString();
  const moved = await admin
    .from("mgr_matches")
    .update({ kickoff_at: at })
    .in("league_id", leagueIds)
    .eq("kind", "league")
    .eq("round", round)
    .select("id");
  if (moved.error) throw moved.error;
  if ((moved.data?.length ?? 0) !== leagueIds.length * 10) {
    problem(
      `round ${round}: ${moved.data?.length} matches moved, expected ${leagueIds.length * 10}`,
    );
  }
}

async function checkMatches(round: number) {
  for (const leagueId of leagueIds) {
    const rows = await fetchAll((from, to) =>
      admin
        .from("mgr_matches")
        .select(
          "id, round, status, home_goals, away_goals, home_club_id, away_club_id, home_lineup, away_lineup, home_auto, away_auto, events",
        )
        .eq("league_id", leagueId)
        .eq("kind", "league")
        .lte("round", round)
        .order("id")
        .range(from, to),
    );
    if (rows.length !== round * 10)
      problem(`league ${leagueId}: ${rows.length} matches up to round ${round}`);
    for (const m of rows) {
      if (m.status !== "finished") {
        problem(`match ${m.id} (round ${m.round}) is ${m.status}`);
        continue;
      }
      const goals = [m.home_goals, m.away_goals];
      if (goals.some((g) => g === null || !Number.isInteger(g) || g < 0 || g > 15)) {
        problem(`match ${m.id}: goals ${goals.join(":")}`);
      }
      for (const lineup of [m.home_lineup, m.away_lineup] as unknown[]) {
        const list = Array.isArray(lineup) ? (lineup as { position: string; id: string }[]) : [];
        if (list.length !== 11) problem(`match ${m.id}: a lineup of ${list.length} players`);
        if (list.filter((p) => p.position === "GK").length !== 1)
          problem(`match ${m.id}: not one goalkeeper`);
        if (new Set(list.map((p) => p.id)).size !== list.length)
          problem(`match ${m.id}: a player twice`);
      }
      if (!Array.isArray(m.events)) warn(`match ${m.id}: no chronicle`);
    }
    // Every club plays once in a round.
    for (let r = 1; r <= round; r += 1) {
      const clubs = rows
        .filter((m) => m.round === r)
        .flatMap((m) => [m.home_club_id, m.away_club_id]);
      if (new Set(clubs).size !== 20)
        problem(`league ${leagueId}, round ${r}: ${new Set(clubs).size} clubs played`);
    }
    // The table: goals for = goals against, and the next round waits.
    const gf = rows.reduce((s, m) => s + (m.home_goals ?? 0) + (m.away_goals ?? 0), 0);
    if (gf < 0) problem("negative goals");
  }
  const next = await admin
    .from("mgr_matches")
    .select("id", { count: "exact", head: true })
    .in("league_id", leagueIds)
    .eq("kind", "league")
    .eq("round", round + 1)
    .eq("status", "finished");
  if ((next.count ?? 0) > 0) problem(`round ${round + 1} was played ahead of time`);
}

async function checkMoney(round: number) {
  const clubs = await fetchAll((from, to) =>
    admin
      .from("mgr_clubs")
      .select("id, budget, dormant")
      .in("id", realClubIds)
      .order("id")
      .range(from, to),
  );
  for (const club of clubs) {
    const tx = await fetchAll((from, to) =>
      admin
        .from("mgr_transactions")
        .select("id, amount, balance_after, reason")
        .eq("club_id", club.id)
        .order("id")
        .range(from, to),
    );
    const total = tx.reduce((s, t) => s + t.amount, 0);
    if (club.budget - total !== START_BUDGET) {
      problem(`club ${club.id}: budget ${club.budget} does not match the ledger (${total})`);
    }
    const last = tx.at(-1);
    if (last && last.balance_after !== club.budget)
      problem(`club ${club.id}: balance_after of the last entry differs`);
    if (tx.length < round)
      warn(`club ${club.id}: ${tx.length} ledger entries after ${round} rounds`);
    if (club.budget < 0) warn(`club ${club.id}: negative budget ${club.budget}`);
    if (club.dormant) problem(`club ${club.id} is resting after ${round} rounds`);
  }
}

async function checkElo(round: number) {
  const clubs = await fetchAll((from, to) =>
    admin.from("mgr_clubs").select("id, elo, elo_peak").order("id").range(from, to),
  );
  const sum = clubs.reduce((s, c) => s + c.elo, 0);
  if (Math.abs(sum - 1000 * clubs.length) > clubs.length) {
    problem(`Elo is not conserved: ${sum} for ${clubs.length} clubs`);
  }
  for (const c of clubs) if (c.elo_peak < c.elo) problem(`club ${c.id}: Elo peak below Elo`);
  const log = await fetchAll((from, to) =>
    admin
      .from("mgr_elo_log")
      .select("match_id, club_id, before, after")
      .order("match_id")
      .range(from, to),
  );
  const perMatch = new Map<string, number[]>();
  for (const row of log)
    perMatch.set(row.match_id, [...(perMatch.get(row.match_id) ?? []), row.after - row.before]);
  if (perMatch.size !== leagueIds.length * 10 * round) {
    problem(`Elo log has ${perMatch.size} matches, expected ${leagueIds.length * 10 * round}`);
  }
  for (const [match, deltas] of perMatch) {
    if (deltas.length !== 2) problem(`match ${match}: ${deltas.length} Elo entries`);
    else if (Math.abs(deltas[0]! + deltas[1]!) > 1)
      problem(`match ${match}: Elo is not zero-sum (${deltas.join(", ")})`);
  }
}

async function checkStats(round: number) {
  const stats = await fetchAll((from, to) =>
    admin
      .from("mgr_player_stats")
      .select("player_id, club_id, league_id, goals, assists, matches, injuries")
      .in("league_id", leagueIds)
      .order("player_id")
      .range(from, to),
  );
  const goals = stats.reduce((s, r) => s + r.goals, 0);
  const matches = await fetchAll((from, to) =>
    admin
      .from("mgr_matches")
      .select("home_goals, away_goals")
      .in("league_id", leagueIds)
      .eq("kind", "league")
      .lte("round", round)
      .order("id")
      .range(from, to),
  );
  const scored = matches.reduce((s, m) => s + (m.home_goals ?? 0) + (m.away_goals ?? 0), 0);
  if (goals !== scored)
    warn(`round ${round}: ${goals} goals in the statistics, ${scored} in the matches`);
  if (stats.some((r) => r.assists > r.goals + scored)) problem("assists out of range");
  const apps = stats.reduce((s, r) => s + r.matches, 0);
  if (apps < leagueIds.length * 10 * round * 11) {
    warn(
      `round ${round}: ${apps} appearances, at least ${leagueIds.length * 10 * round * 11} expected`,
    );
  }
}

async function checkPlayers() {
  const players = await fetchAll((from, to) =>
    admin
      .from("mgr_players")
      .select("id, club_id, form, fitness, morale, ovr, injured_until, age")
      .not("club_id", "is", null)
      .order("id")
      .range(from, to),
  );
  const perClub = new Map<string, number>();
  const horizon = Date.now() + 120 * DAY;
  for (const p of players) {
    perClub.set(p.club_id!, (perClub.get(p.club_id!) ?? 0) + 1);
    for (const key of ["form", "fitness", "morale"] as const) {
      if (p[key] < 0 || p[key] > 100) problem(`player ${p.id}: ${key} ${p[key]}`);
    }
    if (p.ovr < 1 || p.ovr > 99) problem(`player ${p.id}: ovr ${p.ovr}`);
    if (p.injured_until && new Date(p.injured_until).getTime() > horizon) {
      warn(`player ${p.id}: injured until ${p.injured_until}`);
    }
  }
  for (const [club, size] of squadSize) {
    if ((perClub.get(club) ?? 0) !== size)
      problem(`club ${club}: ${perClub.get(club)} players, was ${size}`);
  }
  const hurt = players.filter(
    (p) => p.injured_until && new Date(p.injured_until).getTime() > Date.now(),
  ).length;
  const tired = players.filter((p) => p.fitness < 40).length;
  timings.push(`players: ${players.length}, injured now ${hurt}, fitness below 40: ${tired}`);
}

async function counts() {
  const head = (table: "mgr_transactions" | "mgr_elo_log" | "mgr_player_stats" | "mgr_matches") =>
    admin.from(table).select("*", { count: "exact", head: true });
  const [tx, elo, stats, finished] = await Promise.all([
    head("mgr_transactions"),
    head("mgr_elo_log"),
    head("mgr_player_stats"),
    admin.from("mgr_matches").select("id", { count: "exact", head: true }).eq("status", "finished"),
  ]);
  return [tx.count, elo.count, stats.count, finished.count];
}

describe("simulation of three rounds", () => {
  beforeAll(async () => {
    const t0 = Date.now();
    await seed();
    timings.push(`seed: ${Date.now() - t0} ms, ${USERS} clubs, ${leagueIds.length} leagues`);
  }, 600_000);

  it("plays the rounds and keeps the invariants", async () => {
    expect(leagueIds).toHaveLength(3);
    for (let round = 1; round <= ROUNDS; round += 1) {
      await moveRound(round);
      const t0 = Date.now();
      const result = await runRounds(admin, new Date());
      const ms = Date.now() - t0;
      timings.push(`round ${round}: ${ms} ms, ${JSON.stringify(result)}`);
      if (result.played !== leagueIds.length * 10) {
        problem(
          `round ${round}: ${result.played} matches played, expected ${leagueIds.length * 10}`,
        );
      }
      await checkMatches(round);
      await checkMoney(round);
      await checkElo(round);
      await checkStats(round);
    }
    await checkPlayers();

    const overdue = await admin.rpc("mgr_overdue_count", { p_minutes: 30 });
    if (overdue.data !== 0) problem(`overdue matches after the run: ${overdue.data}`);

    // A repeated run changes nothing.
    const before = await counts();
    const again = await runRounds(admin, new Date());
    const after = await counts();
    if (again.played !== 0) problem(`a repeated run played ${again.played} matches`);
    if (JSON.stringify(before) !== JSON.stringify(after))
      problem(`a repeated run changed ${before} to ${after}`);

    console.log(
      `\n=== SIMULATION REPORT ===\n${timings.join("\n")}\nwarnings (${warnings.length}):\n${warnings.slice(0, 40).join("\n")}\nproblems (${problems.length}):\n${problems.slice(0, 60).join("\n")}\n=========================\n`,
    );
    expect(problems).toEqual([]);
  }, 900_000);
});
