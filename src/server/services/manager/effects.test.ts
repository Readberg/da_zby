import { describe, expect, it } from "vitest";
import { overallRating, type Attribute } from "@/lib/manager/attributes";
import { simulateMatch, type Side } from "./engine";
import {
  ageGrowth,
  computeEffects,
  computePreseasonDay,
  growthChance,
  outcomeOf,
  type PlayerState,
} from "./effects";

const KICKOFF = new Date("2026-11-18T07:00:00Z");

function midfielder(over: Partial<PlayerState> = {}): PlayerState {
  const attributes: Partial<Record<Attribute, number>> = {
    dribbling: 60,
    passing: 60,
    shooting: 60,
    tackling: 60,
    heading: 60,
    vision: 60,
    positioning: 60,
    decisions: 60,
    composure: 60,
    off_the_ball: 60,
    speed: 60,
    stamina: 60,
    strength: 60,
    agility: 60,
  };
  return {
    id: "p1",
    position: "MID",
    age: 22,
    ovr: overallRating("MID", attributes),
    form: 80,
    fitness: 80,
    morale: 80,
    idleRounds: 0,
    injuredUntil: null,
    potential: 80,
    trainingFocus: null,
    attributes,
    ...over,
  };
}

const run = (
  players: PlayerState[],
  options: {
    played?: string[];
    outcome?: "win" | "draw" | "loss";
    injuries?: [string, number][];
    seed?: string;
  } = {},
) =>
  computeEffects({
    seed: options.seed ?? "m1",
    kickoff: KICKOFF,
    players,
    played: new Set(options.played ?? []),
    outcome: options.outcome ?? "draw",
    injuries: new Map(options.injuries ?? []),
  });

describe("what a match does to the players (the brief)", () => {
  it("a player of the lineup gains 2 form and loses 6 fitness", () => {
    const [effect] = run([midfielder()], { played: ["p1"] });
    expect(effect).toMatchObject({ form: 82, fitness: 74, idle_rounds: 0 });
  });

  it("morale follows the result for those who played: win +2, draw 0, loss -1", () => {
    expect(run([midfielder()], { played: ["p1"], outcome: "win" })[0]!.morale).toBe(82);
    expect(run([midfielder()], { played: ["p1"], outcome: "draw" })[0]!.morale).toBe(80);
    expect(run([midfielder()], { played: ["p1"], outcome: "loss" })[0]!.morale).toBe(79);
  });

  it("a player on the bench loses 1 form and rests: +5 fitness", () => {
    const [effect] = run([midfielder()], { outcome: "win" });
    expect(effect).toMatchObject({ form: 79, fitness: 85, morale: 80, idle_rounds: 1 });
  });

  it("morale of a player without play drops by 1 on every third round, not before", () => {
    const morale = (idleRounds: number) => run([midfielder({ idleRounds })])[0]!.morale;
    expect(morale(0)).toBe(80);
    expect(morale(1)).toBe(80);
    expect(morale(2)).toBe(79);
    expect(morale(3)).toBe(80);
    expect(morale(5)).toBe(79);
  });

  it("keeps form, fitness and morale between 0 and 100", () => {
    const high = run([midfielder({ form: 100, fitness: 100, morale: 100 })], {
      outcome: "win",
      played: [],
    })[0]!;
    expect(high.fitness).toBe(100);
    const low = run([midfielder({ form: 0, fitness: 3, morale: 0 })], {
      played: ["p1"],
      outcome: "loss",
    })[0]!;
    expect(low).toMatchObject({ form: 2, fitness: 0, morale: 0 });
  });

  it("starts an injury of the given length from the kickoff", () => {
    const [effect] = run([midfielder()], { played: ["p1"], injuries: [["p1", 3]] });
    expect(effect!.injured_until).toBe("2026-11-21T07:00:00.000Z");
  });

  it("is the same for the same seed", () => {
    const players = [midfielder({ trainingFocus: "passing", potential: 99, age: 18 })];
    expect(run(players, { seed: "s" })).toEqual(run(players, { seed: "s" }));
  });
});

describe("training", () => {
  const trainer = (over: Partial<PlayerState> = {}) =>
    midfielder({ trainingFocus: "passing", potential: 99, age: 19, id: "t", ...over });

  it("costs 3 fitness on top of the match", () => {
    const [effect] = run([trainer()], { played: ["t"] });
    expect(effect!.fitness).toBe(71);
  });

  it("is skipped by a player who is too tired, who is injured or got hurt in the match", () => {
    expect(run([trainer({ fitness: 25 })])[0]!.fitness).toBe(30);
    expect(run([trainer({ injuredUntil: new Date("2026-11-19T00:00:00Z") })])[0]!.fitness).toBe(85);
    expect(run([trainer()], { played: ["t"], injuries: [["t", 2]] })[0]!.fitness).toBe(74);
  });

  it("makes a young player with room to grow better over many rounds, by one point at a time", () => {
    let grown = 0;
    for (let i = 0; i < 400; i += 1) {
      const effect = run([trainer({ potential: 99 })], { seed: `grow-${i}` })[0]!;
      if (effect.attributes) {
        grown += 1;
        expect(effect.attributes.passing).toBe(61);
        expect(effect.ovr).toBeGreaterThanOrEqual(60);
      }
    }
    // About 0.12 * 1.5 * (39/60) = 11% of the rounds.
    expect(grown).toBeGreaterThan(20);
    expect(grown).toBeLessThan(90);
  });

  it("never lifts a player above his potential", () => {
    const player = trainer({ ovr: 60, potential: 60 });
    for (let i = 0; i < 300; i += 1) {
      expect(run([player], { seed: `cap-${i}` })[0]!.attributes).toBeUndefined();
    }
  });

  it("grows slower with age and slower the higher the attribute is", () => {
    const base = trainer({ potential: 99, ovr: 60 });
    expect(growthChance({ ...base, age: 19 }, 60)).toBeGreaterThan(
      growthChance({ ...base, age: 25 }, 60),
    );
    expect(growthChance({ ...base, age: 25 }, 60)).toBeGreaterThan(
      growthChance({ ...base, age: 31 }, 60),
    );
    expect(growthChance({ ...base, age: 25 }, 60)).toBeGreaterThan(
      growthChance({ ...base, age: 25 }, 90),
    );
    expect(growthChance({ ...base, potential: 60 }, 60)).toBe(0);
    expect(ageGrowth(34)).toBeLessThan(ageGrowth(30));
  });
});

describe("injuries in a match", () => {
  const side = (): Side => ({
    mentality: "balanced",
    players: (
      ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD"] as const
    ).map((position, i) => ({ id: `p${i}`, name: `Имя Фамилия${i}`, position, real: 55 })),
  });

  it("hurts about 1 starter in 80 and shows it in the chronicle", () => {
    let hurt = 0;
    const n = 800;
    for (let i = 0; i < n; i += 1) {
      const result = simulateMatch(`inj-${i}`, side(), side());
      hurt += result.injuries.length;
      expect(result.events.filter((e) => e.t === "injury")).toHaveLength(result.injuries.length);
      for (const injury of result.injuries) {
        expect(injury.days).toBeGreaterThanOrEqual(1);
        expect(injury.days).toBeLessThanOrEqual(21);
      }
    }
    // 22 starters × 1.2% = 0.26 injuries a match.
    expect(hurt / n).toBeGreaterThan(0.15);
    expect(hurt / n).toBeLessThan(0.4);
  });

  it("does not change the score of a match", () => {
    const withInjuries = simulateMatch("same", side(), side());
    expect(withInjuries.homeGoals).toBe(simulateMatch("same", side(), side()).homeGoals);
  });
});

describe("outcomeOf", () => {
  it("is win, draw or loss from the side of the club", () => {
    expect(outcomeOf(2, 1)).toBe("win");
    expect(outcomeOf(1, 1)).toBe("draw");
    expect(outcomeOf(0, 3)).toBe("loss");
  });
});

describe("a friendly", () => {
  const friendly = (
    players: PlayerState[],
    options: { played?: string[]; outcome?: "win" | "draw" | "loss" } = {},
  ) =>
    computeEffects({
      seed: "f1",
      kickoff: KICKOFF,
      players,
      played: new Set(options.played ?? []),
      outcome: options.outcome ?? "draw",
      injuries: new Map(),
      mode: "friendly",
    });

  it("changes form, fitness and morale half as much as a match of the league", () => {
    const [played] = friendly([midfielder()], { played: ["p1"], outcome: "win" });
    expect(played).toMatchObject({ form: 81, fitness: 77, morale: 81 });
    const [bench] = friendly([midfielder()]);
    expect(bench).toMatchObject({ form: 80, fitness: 82 });
  });

  it("does not count as a round without play and does not train", () => {
    const [bench] = friendly([midfielder({ idleRounds: 2 })]);
    expect(bench!.idle_rounds).toBe(2);
    expect(bench!.morale).toBe(80);
    const [trainer] = friendly([midfielder({ trainingFocus: "passing", potential: 99, age: 19 })], {
      played: ["p1"],
    });
    expect(trainer!.attributes).toBeUndefined();
    expect(trainer!.fitness).toBe(77);
  });
});

describe("a day of the preseason", () => {
  const day = new Date("2026-11-21T07:00:00Z");

  it("lets everybody rest: +5 fitness", () => {
    const [effect] = computePreseasonDay({ seed: "s", day, players: [midfielder()] });
    expect(effect).toMatchObject({ fitness: 85, ovr: midfielder().ovr });
  });

  it("trains at half strength: half the cost and half the chance to grow", () => {
    const trainer = midfielder({ trainingFocus: "passing", potential: 99, age: 19 });
    expect(computePreseasonDay({ seed: "s", day, players: [trainer] })[0]!.fitness).toBe(84);
    let preseason = 0;
    let season = 0;
    for (let i = 0; i < 1500; i += 1) {
      if (computePreseasonDay({ seed: `d${i}`, day, players: [trainer] })[0]!.attributes)
        preseason += 1;
      if (
        computeEffects({
          seed: `d${i}`,
          kickoff: KICKOFF,
          players: [trainer],
          played: new Set(),
          outcome: "draw",
          injuries: new Map(),
        })[0]!.attributes
      )
        season += 1;
    }
    expect(preseason).toBeGreaterThan(season * 0.35);
    expect(preseason).toBeLessThan(season * 0.7);
  });

  it("does not train the injured or the exhausted", () => {
    const hurt = midfielder({
      trainingFocus: "passing",
      injuredUntil: new Date("2026-11-22T00:00:00Z"),
    });
    expect(computePreseasonDay({ seed: "s", day, players: [hurt] })[0]!.fitness).toBe(85);
    const tired = midfielder({ trainingFocus: "passing", fitness: 20 });
    expect(computePreseasonDay({ seed: "s", day, players: [tired] })[0]!.fitness).toBe(25);
  });
});
