import { describe, expect, it } from "vitest";
import { autoLineup, formationCounts, FORMATIONS, lineupFits } from "@/lib/manager/formations";
import { buildSchedule, firstKickoff, LEAGUE_SIZE, ROUNDS } from "@/lib/manager/schedule";
import { computeTable } from "@/lib/manager/table";
import { simulateMatch, type Side, type SidePlayer } from "./engine";

function side(real: number, mentality: Side["mentality"] = "balanced"): Side {
  const positions = [
    "GK",
    "DEF",
    "DEF",
    "DEF",
    "DEF",
    "MID",
    "MID",
    "MID",
    "MID",
    "FWD",
    "FWD",
  ] as const;
  const players: SidePlayer[] = positions.map((position, i) => ({
    id: `p${i}`,
    name: `Имя Фамилия${i}`,
    position,
    real,
  }));
  return { players, mentality };
}

describe("simulateMatch", () => {
  it("is reproducible: the same seed and sides give the same match", () => {
    expect(simulateMatch("m1", side(55), side(55))).toEqual(
      simulateMatch("m1", side(55), side(55)),
    );
  });

  it("tells the story in order, from kick-off to the final whistle", () => {
    const { events } = simulateMatch("order", side(55), side(55));
    expect(events[0]).toEqual({ m: 0, t: "kickoff" });
    expect(events.at(-1)).toEqual({ m: 90, t: "full_time" });
    expect(events.some((e) => e.t === "half_time")).toBe(true);
    const minutes = events.map((e) => e.m);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
  });

  it("counts the goals of the chronicle", () => {
    for (let i = 0; i < 30; i += 1) {
      const result = simulateMatch(`goals-${i}`, side(55), side(55));
      const goals = result.events.filter((e) => e.t === "goal");
      expect(goals.filter((e) => e.s === "home")).toHaveLength(result.homeGoals);
      expect(goals.filter((e) => e.s === "away")).toHaveLength(result.awayGoals);
      for (const goal of goals) expect(goal.p).toBeTruthy();
    }
  });

  it("gives about 2–3.5 goals a match between equal teams", () => {
    let total = 0;
    const n = 400;
    for (let i = 0; i < n; i += 1) {
      const r = simulateMatch(`avg-${i}`, side(55), side(55));
      total += r.homeGoals + r.awayGoals;
    }
    const average = total / n;
    expect(average).toBeGreaterThan(2);
    expect(average).toBeLessThan(3.8);
  });

  it("lets the stronger team win more often, but not always", () => {
    let strong = 0;
    let weak = 0;
    for (let i = 0; i < 400; i += 1) {
      const r = simulateMatch(`strength-${i}`, side(66), side(50));
      if (r.homeGoals > r.awayGoals) strong += 1;
      if (r.homeGoals < r.awayGoals) weak += 1;
    }
    expect(strong).toBeGreaterThan(weak * 2);
    expect(weak).toBeGreaterThan(0);
  });

  it("makes an attacking side score more and concede more", () => {
    let attackFor = 0;
    let attackAgainst = 0;
    let balancedFor = 0;
    let balancedAgainst = 0;
    for (let i = 0; i < 600; i += 1) {
      const a = simulateMatch(`ment-${i}`, side(55, "attack"), side(55));
      const b = simulateMatch(`ment-${i}`, side(55), side(55));
      attackFor += a.homeGoals;
      attackAgainst += a.awayGoals;
      balancedFor += b.homeGoals;
      balancedAgainst += b.awayGoals;
    }
    expect(attackFor).toBeGreaterThan(balancedFor);
    expect(attackAgainst).toBeGreaterThan(balancedAgainst);
  });
});

describe("buildSchedule", () => {
  const schedule = buildSchedule();

  it("has 38 rounds of 10 matches", () => {
    expect(schedule).toHaveLength(380);
    expect(Math.max(...schedule.map((f) => f.round))).toBe(ROUNDS);
    for (let round = 1; round <= ROUNDS; round += 1) {
      expect(schedule.filter((f) => f.round === round)).toHaveLength(LEAGUE_SIZE / 2);
    }
  });

  it("has every club once in every round", () => {
    for (let round = 1; round <= ROUNDS; round += 1) {
      const clubs = schedule.filter((f) => f.round === round).flatMap((f) => [f.home, f.away]);
      expect(new Set(clubs).size).toBe(LEAGUE_SIZE);
    }
  });

  it("has every pair twice, once at home of each", () => {
    const seen = new Set(schedule.map((f) => `${f.home}-${f.away}`));
    expect(seen.size).toBe(380);
    for (const f of schedule) expect(seen.has(`${f.away}-${f.home}`)).toBe(true);
  });

  it("does not leave a club at home for a whole run", () => {
    for (let club = 0; club < LEAGUE_SIZE; club += 1) {
      const home = schedule.filter((f) => f.home === club).length;
      expect(home).toBe(19);
      let run = 0;
      let longest = 0;
      for (let round = 1; round <= ROUNDS; round += 1) {
        const f = schedule.find((x) => x.round === round && (x.home === club || x.away === club))!;
        run = f.home === club ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
      expect(longest).toBeLessThanOrEqual(3);
    }
  });
});

describe("firstKickoff", () => {
  it("is the next 07:00 UTC (10:00 in Moscow) at least an hour away", () => {
    expect(firstKickoff(new Date("2026-11-17T03:00:00Z")).toISOString()).toBe(
      "2026-11-17T07:00:00.000Z",
    );
    expect(firstKickoff(new Date("2026-11-17T06:30:00Z")).toISOString()).toBe(
      "2026-11-18T07:00:00.000Z",
    );
    expect(firstKickoff(new Date("2026-11-17T12:00:00Z")).toISOString()).toBe(
      "2026-11-18T07:00:00.000Z",
    );
  });
});

describe("computeTable", () => {
  const clubs = [
    { id: "a", name: "Альфа" },
    { id: "b", name: "Бета" },
    { id: "c", name: "Гамма" },
  ];

  it("gives 3 points for a win, 1 for a draw and sorts by points, difference, goals", () => {
    const table = computeTable(clubs, [
      { homeClubId: "a", awayClubId: "b", homeGoals: 2, awayGoals: 0 },
      { homeClubId: "b", awayClubId: "c", homeGoals: 1, awayGoals: 1 },
      { homeClubId: "c", awayClubId: "a", homeGoals: 0, awayGoals: 0 },
    ]);
    expect(table.map((r) => [r.clubId, r.points, r.goalDifference])).toEqual([
      ["a", 4, 2],
      ["c", 2, 0],
      ["b", 1, -2],
    ]);
    expect(table[0]).toMatchObject({
      played: 2,
      won: 1,
      drawn: 1,
      lost: 0,
      goalsFor: 2,
      goalsAgainst: 0,
    });
  });

  it("lists clubs that have not played yet, alphabetically", () => {
    expect(computeTable(clubs, []).map((r) => r.clubId)).toEqual(["a", "b", "c"]);
  });
});

describe("formations", () => {
  const squad = [
    ...[70, 60].map((real, i) => ({ id: `g${i}`, position: "GK" as const, real })),
    ...[70, 68, 66, 64, 62, 60, 58].map((real, i) => ({
      id: `d${i}`,
      position: "DEF" as const,
      real,
    })),
    ...[71, 69, 67, 65, 63, 61, 59].map((real, i) => ({
      id: `m${i}`,
      position: "MID" as const,
      real,
    })),
    ...[72, 70, 68, 50].map((real, i) => ({ id: `f${i}`, position: "FWD" as const, real })),
  ];

  it("needs 1 GK and the line counts of the formation", () => {
    expect(formationCounts("4-3-3")).toEqual({ GK: 1, DEF: 4, MID: 3, FWD: 3 });
    for (const formation of FORMATIONS) {
      const c = formationCounts(formation);
      expect(c.GK + c.DEF + c.MID + c.FWD).toBe(11);
    }
  });

  it("picks the strongest eleven of the best formation, with no penalty for not choosing", () => {
    const lineup = autoLineup(squad)!;
    expect(lineup.playerIds).toHaveLength(11);
    expect(lineup.playerIds).toContain("g0");
    expect(lineup.playerIds).not.toContain("g1");
    const picked = squad.filter((p) => lineup.playerIds.includes(p.id));
    expect(lineupFits(lineup.formation, picked)).toBe(true);
  });

  it("recognises a lineup that does not fit", () => {
    expect(lineupFits("4-4-2", squad.slice(0, 11))).toBe(false);
  });
});
