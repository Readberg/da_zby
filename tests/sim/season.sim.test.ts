import { beforeAll, describe, expect, it } from "vitest";
import { fetchAll } from "@/server/services/paginate";
import { runRounds } from "@/server/services/manager/season";
import { DAY, START_BUDGET, admin, seedWorld, type World } from "./world";

// A whole season on a real local Supabase stack (DAZBY-163): 45 real clubs in three leagues, 38
// rounds by the full scheduler (`runRounds`), the end of the season (prizes, ageing, retirement,
// inactive clubs), the preseason and the opening of the second season. Half of the clubs save their
// lineup, the others stay on the automatic one. A hard problem fails the test; a suspicious thing is
// a warning and goes to the report.
const USERS = 45;
const TOTAL = 38;
const OFFSET_DAYS = TOTAL + 12;

const problems: string[] = [];
const warnings: string[] = [];
const report: string[] = [];
let world: World;
const T0 = Date.now();

const problem = (text: string) => problems.push(text);
const warn = (text: string) => warnings.push(text);

type Result = Awaited<ReturnType<typeof runRounds>>;

/** The scheduler is called again and again, as it is every few minutes, until it has nothing to do. */
async function drain(label: string) {
  const total = {
    played: 0,
    closed: 0,
    days: 0,
    opened: 0,
    pools: 0,
    released: 0,
    settled: 0,
    expired: 0,
  };
  let calls = 0;
  const t0 = Date.now();
  for (; calls < 120; calls += 1) {
    const r: Result = await runRounds(admin, new Date());
    for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += r[key];
    if (
      !r.partial &&
      r.played + r.closed + r.days + r.opened + r.released + r.settled + r.expired === 0
    ) {
      break;
    }
  }
  report.push(`${label}: ${Date.now() - t0} ms, ${calls + 1} calls, ${JSON.stringify(total)}`);
  return total;
}

async function moveRound(round: number) {
  const at = new Date(T0 - (OFFSET_DAYS - round) * DAY).toISOString();
  const moved = await admin
    .from("mgr_matches")
    .update({ kickoff_at: at })
    .in("league_id", world.leagueIds)
    .eq("kind", "league")
    .eq("season", 1)
    .eq("round", round)
    .select("id");
  if (moved.error) throw moved.error;
  if ((moved.data?.length ?? 0) !== world.leagueIds.length * 10)
    problem(`round ${round}: moved ${moved.data?.length}`);
}

async function leagueMatches(leagueId: string, season: number) {
  return fetchAll((from, to) =>
    admin
      .from("mgr_matches")
      .select(
        "id, round, status, home_goals, away_goals, home_club_id, away_club_id, home_lineup, away_lineup, kickoff_at",
      )
      .eq("league_id", leagueId)
      .eq("kind", "league")
      .eq("season", season)
      .order("id")
      .range(from, to),
  );
}

async function checkSeasonOneMatches() {
  for (const leagueId of world.leagueIds) {
    const rows = await leagueMatches(leagueId, 1);
    if (rows.length !== 380) problem(`league ${leagueId}: ${rows.length} matches in season 1`);
    for (const m of rows) {
      if (m.status !== "finished") problem(`match ${m.id} (round ${m.round}) is ${m.status}`);
      for (const g of [m.home_goals, m.away_goals]) {
        if (g === null || !Number.isInteger(g) || g < 0 || g > 15)
          problem(`match ${m.id}: goals ${g}`);
      }
      for (const lineup of [m.home_lineup, m.away_lineup] as unknown[]) {
        const list = Array.isArray(lineup) ? (lineup as { position: string; id: string }[]) : [];
        if (list.length !== 11 || list.filter((p) => p.position === "GK").length !== 1) {
          problem(`match ${m.id}: a wrong lineup (${list.length} players)`);
        }
      }
    }
    for (let r = 1; r <= TOTAL; r += 1) {
      const clubs = rows
        .filter((m) => m.round === r)
        .flatMap((m) => [m.home_club_id, m.away_club_id]);
      if (new Set(clubs).size !== 20)
        problem(`league ${leagueId}, round ${r}: ${new Set(clubs).size} clubs`);
    }
    // Every pair meets twice, once at home and once away.
    const pairs = new Map<string, number>();
    for (const m of rows)
      pairs.set(
        `${m.home_club_id}>${m.away_club_id}`,
        (pairs.get(`${m.home_club_id}>${m.away_club_id}`) ?? 0) + 1,
      );
    if (pairs.size !== 380 || [...pairs.values()].some((n) => n !== 1))
      problem(`league ${leagueId}: the schedule is not a double round robin`);
  }
}

type Row = { id: string; name: string; points: number; gd: number; gf: number };

/** The table of a finished season, in the order of the game: points, goal difference, goals, name. */
async function tableOf(leagueId: string): Promise<Row[]> {
  const matches = await leagueMatches(leagueId, 1);
  const clubs = await admin.from("mgr_clubs").select("id, name").eq("league_id", leagueId);
  if (clubs.error) throw clubs.error;
  const rows = new Map<string, Row>(
    clubs.data.map((c) => [c.id, { id: c.id, name: c.name, points: 0, gd: 0, gf: 0 }]),
  );
  for (const m of matches) {
    const home = rows.get(m.home_club_id);
    const away = rows.get(m.away_club_id);
    if (!home || !away) continue;
    const hg = m.home_goals ?? 0;
    const ag = m.away_goals ?? 0;
    home.gf += hg;
    away.gf += ag;
    home.gd += hg - ag;
    away.gd += ag - hg;
    if (hg > ag) home.points += 3;
    else if (hg < ag) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || (a.name < b.name ? -1 : 1),
  );
}

async function checkPrizesAndClubs() {
  const clubs = await fetchAll((from, to) =>
    admin
      .from("mgr_clubs")
      .select("id, budget, dormant, elo, elo_peak, user_id, league_id")
      .order("id")
      .range(from, to),
  );
  const dormant = new Map(clubs.map((c) => [c.id, c.dormant]));
  for (const leagueId of world.leagueIds) {
    const table = await tableOf(leagueId);
    for (const [index, row] of table.entries()) {
      const place = index + 1;
      const member = world.members.find((m) => m.clubId === row.id);
      if (!member) continue;
      const tx = await admin
        .from("mgr_transactions")
        .select("amount")
        .eq("club_id", row.id)
        .eq("reason", "prize");
      if (tx.error) throw tx.error;
      const expected = Math.round((4000 * (21 - place)) / 20);
      if (dormant.get(row.id)) {
        if ((tx.data?.length ?? 0) > 0) warn(`a resting club ${member.name} got a prize`);
      } else if (tx.data?.length !== 1 || tx.data[0]!.amount !== expected) {
        problem(
          `${member.name}: place ${place}, prize ${JSON.stringify(tx.data)}, expected ${expected}`,
        );
      }
    }
  }
  // The rule of inactive clubs: no saved lineup = all matches automatic = resting.
  const unsaved = world.members.filter((m) => !m.saved);
  const saved = world.members.filter((m) => m.saved);
  const unsavedResting = unsaved.filter((m) => dormant.get(m.clubId)).length;
  const savedResting = saved.filter((m) => dormant.get(m.clubId)).length;
  report.push(
    `resting after the season: ${unsavedResting}/${unsaved.length} without a saved lineup, ${savedResting}/${saved.length} with one`,
  );
  if (unsavedResting !== unsaved.length)
    problem(`only ${unsavedResting} of ${unsaved.length} automatic clubs are resting`);
  if (savedResting > 0)
    warn(
      `${savedResting} of ${saved.length} clubs with a saved lineup are resting (injuries make a saved lineup unfit?)`,
    );

  // Elo is conserved (the shrink to 1000 keeps the sum), the peak is never below the rating.
  const sum = clubs.reduce((s, c) => s + c.elo, 0);
  if (Math.abs(sum - 1000 * clubs.length) > clubs.length)
    problem(`Elo sum ${sum} for ${clubs.length} clubs`);
  for (const c of clubs) if (c.elo_peak < c.elo) problem(`club ${c.id}: Elo peak below Elo`);
  const spread = clubs.map((c) => c.elo);
  report.push(`Elo after the season: min ${Math.min(...spread)}, max ${Math.max(...spread)}`);

  // Money: the budget is the ledger.
  for (const member of world.members) {
    const club = clubs.find((c) => c.id === member.clubId)!;
    const tx = await fetchAll((from, to) =>
      admin
        .from("mgr_transactions")
        .select("id, amount, balance_after")
        .eq("club_id", member.clubId)
        .order("id")
        .range(from, to),
    );
    const total = tx.reduce((s, t) => s + t.amount, 0);
    if (club.budget - total !== START_BUDGET)
      problem(`${member.name}: budget ${club.budget} against the ledger ${total}`);
    if (tx.length && tx.at(-1)!.balance_after !== club.budget)
      problem(`${member.name}: balance_after of the last entry differs`);
    if (club.budget < 0) warn(`${member.name}: negative budget ${club.budget}`);
  }
}

async function checkPlayers() {
  const players = await fetchAll((from, to) =>
    admin
      .from("mgr_players")
      .select("id, club_id, age, ovr, form, fitness, morale, injured_until")
      .not("club_id", "is", null)
      .order("id")
      .range(from, to),
  );
  const ids = new Set(players.map((p) => p.id));
  const perClub = new Map<string, number>();
  let fresh = 0;
  for (const p of players) {
    perClub.set(p.club_id!, (perClub.get(p.club_id!) ?? 0) + 1);
    for (const key of ["form", "fitness", "morale"] as const) {
      if (p[key] < 0 || p[key] > 100) problem(`player ${p.id}: ${key} ${p[key]}`);
    }
    const before = world.initialAge.get(p.id);
    if (before === undefined) {
      fresh += 1;
      if (p.age < 17 || p.age > 19) problem(`a new player ${p.id} is ${p.age} years old`);
      if (p.ovr < 44 || p.ovr > 52) warn(`a new player ${p.id} has ovr ${p.ovr}`);
    } else if (p.age !== before + 1) {
      problem(`player ${p.id}: age ${p.age}, was ${before}`);
    }
  }
  let gone = 0;
  let tooYoung = 0;
  for (const [id, age] of world.initialAge) {
    if (ids.has(id)) continue;
    gone += 1;
    if (age < 33) tooYoung += 1;
  }
  if (tooYoung > 0)
    warn(`${tooYoung} players younger than 33 left their clubs (a contract that ended?)`);
  for (const [club, size] of world.squadSize) {
    const now = perClub.get(club) ?? 0;
    if (now < 17 || now > 23) problem(`club ${club}: ${now} players`);
    else if (now !== size) warn(`club ${club}: ${now} players, was ${size}`);
  }
  report.push(`players: ${players.length}, left ${gone}, new ${fresh}`);
}

async function counts() {
  const [tx, elo, stats, finished] = await Promise.all([
    admin.from("mgr_transactions").select("*", { count: "exact", head: true }),
    admin.from("mgr_elo_log").select("*", { count: "exact", head: true }),
    admin.from("mgr_player_stats").select("*", { count: "exact", head: true }),
    admin.from("mgr_matches").select("id", { count: "exact", head: true }).eq("status", "finished"),
  ]);
  return [tx.count, elo.count, stats.count, finished.count];
}

describe("simulation of a whole season", () => {
  beforeAll(async () => {
    const t0 = Date.now();
    world = await seedWorld(USERS, true);
    report.push(`seed: ${Date.now() - t0} ms, ${USERS} clubs, ${world.leagueIds.length} leagues`);
  }, 600_000);

  it("plays 38 rounds, closes the season, passes the preseason and opens the next one", async () => {
    expect(world.leagueIds).toHaveLength(3);

    // The first rounds one by one, as the days go by.
    for (let round = 1; round <= 5; round += 1) {
      await moveRound(round);
      const total = await drain(`round ${round}`);
      if (total.played !== world.leagueIds.length * 10)
        problem(`round ${round}: ${total.played} played`);
    }
    // The rest at once: a long pause of the scheduler that has to be caught up.
    for (let round = 6; round <= TOTAL; round += 1) await moveRound(round);
    const rest = await drain("rounds 6-38, end of the season, preseason, opening");
    if (rest.played < world.leagueIds.length * 10 * (TOTAL - 5))
      problem(`only ${rest.played} matches played in the catch-up`);
    if (rest.closed !== world.leagueIds.length)
      problem(`${rest.closed} leagues closed, expected ${world.leagueIds.length}`);
    if (rest.opened !== world.leagueIds.length)
      problem(`${rest.opened} leagues opened, expected ${world.leagueIds.length}`);
    if (rest.days < world.leagueIds.length * 4) warn(`only ${rest.days} preseason days applied`);

    await checkSeasonOneMatches();
    await checkPrizesAndClubs();
    await checkPlayers();

    // Statistics of the first season: goals in the statistics are the goals of the matches.
    const stats = await fetchAll((from, to) =>
      admin
        .from("mgr_player_stats")
        .select("player_id, goals, matches, season")
        .eq("season", 1)
        .in("league_id", world.leagueIds)
        .order("player_id")
        .range(from, to),
    );
    let scored = 0;
    for (const leagueId of world.leagueIds) {
      for (const m of await leagueMatches(leagueId, 1))
        scored += (m.home_goals ?? 0) + (m.away_goals ?? 0);
    }
    const inStats = stats.reduce((s, r) => s + r.goals, 0);
    if (inStats !== scored)
      warn(`season 1: ${inStats} goals in the statistics, ${scored} in the matches`);
    report.push(
      `season 1: ${scored} goals in ${world.leagueIds.length * 380} matches (${(scored / (world.leagueIds.length * 380)).toFixed(2)} a match)`,
    );

    // The second season is open and its due rounds are played.
    for (const leagueId of world.leagueIds) {
      const league = await admin
        .from("mgr_leagues")
        .select("season, phase")
        .eq("id", leagueId)
        .single();
      if (league.data?.season !== 2 || league.data.phase !== "season")
        problem(`league ${leagueId}: ${JSON.stringify(league.data)}`);
      const rows = await leagueMatches(leagueId, 2);
      if (rows.length !== 380) problem(`league ${leagueId}: ${rows.length} matches in season 2`);
      const late = rows.filter(
        (m) => new Date(m.kickoff_at).getTime() < Date.now() - 3_600_000 && m.status !== "finished",
      );
      if (late.length)
        problem(`league ${leagueId}: ${late.length} due matches of season 2 are not played`);
    }
    const overdue = await admin.rpc("mgr_overdue_count", { p_minutes: 30 });
    if (overdue.data !== 0) problem(`overdue matches: ${overdue.data}`);

    // A repeated run changes nothing.
    const before = await counts();
    const again = await drain("a repeated run");
    const after = await counts();
    if (again.played + again.closed + again.opened !== 0)
      problem(`a repeated run did something: ${JSON.stringify(again)}`);
    if (JSON.stringify(before) !== JSON.stringify(after))
      problem(`a repeated run changed ${before} to ${after}`);

    console.log(
      `\n=== SEASON SIMULATION REPORT ===\n${report.join("\n")}\nwarnings (${warnings.length}):\n${warnings.slice(0, 40).join("\n")}\nproblems (${problems.length}):\n${problems.slice(0, 60).join("\n")}\n================================\n`,
    );
    expect(problems).toEqual([]);
  }, 1_800_000);
});
