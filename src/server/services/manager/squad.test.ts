import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  attributesOf,
  overallRating,
  realRating,
} from "@/lib/manager/attributes";
import { generateSquad, generateYouth, SQUAD_SIZE, SQUAD_TOTAL_OVR } from "./squad";

const seeds = Array.from({ length: 50 }, (_, i) => `seed-${i}`);

describe("generateSquad", () => {
  it("makes 20 players: 2 GK, 7 DEF, 7 MID, 4 FWD", () => {
    const squad = generateSquad("a", "BY");
    expect(squad).toHaveLength(SQUAD_SIZE);
    const count = (position: string) => squad.filter((p) => p.position === position).length;
    expect([count("GK"), count("DEF"), count("MID"), count("FWD")]).toEqual([2, 7, 7, 4]);
  });

  it("gives every club the same total rating, whatever the seed", () => {
    for (const seed of seeds) {
      const total = generateSquad(seed, "BY").reduce((sum, p) => sum + p.ovr, 0);
      expect(total).toBe(SQUAD_TOTAL_OVR);
    }
  });

  it("makes ratings that really follow from the attributes", () => {
    for (const seed of seeds.slice(0, 10)) {
      for (const player of generateSquad(seed, "BY")) {
        expect(overallRating(player.position, player.attributes)).toBe(player.ovr);
      }
    }
  });

  it("is reproducible: the same seed gives the same squad, another seed another one", () => {
    expect(generateSquad("same", "BY")).toEqual(generateSquad("same", "BY"));
    expect(generateSquad("one", "BY")).not.toEqual(generateSquad("two", "BY"));
  });

  it("has 16 players of 18–26 and 4 of 27–35", () => {
    for (const seed of seeds) {
      const ages = generateSquad(seed, "BY").map((p) => p.age);
      expect(ages.filter((a) => a >= 18 && a <= 26)).toHaveLength(16);
      expect(ages.filter((a) => a >= 27 && a <= 35)).toHaveLength(4);
    }
  });

  it("gives 14 attributes to a field player and 7 to a goalkeeper, all on the 1–99 scale", () => {
    for (const player of generateSquad("scale", "BY")) {
      const keys = Object.keys(player.attributes);
      expect(keys.sort()).toEqual([...attributesOf(player.position)].sort());
      expect(keys).toHaveLength(player.position === "GK" ? 7 : 14);
      for (const value of Object.values(player.attributes)) {
        expect(value).toBeGreaterThanOrEqual(ATTRIBUTE_MIN);
        expect(value).toBeLessThanOrEqual(ATTRIBUTE_MAX);
      }
    }
  });

  it("keeps the potential above the rating and below 100", () => {
    for (const player of generateSquad("potential", "BY")) {
      expect(player.potential).toBeGreaterThan(player.ovr);
      expect(player.potential).toBeLessThanOrEqual(ATTRIBUTE_MAX);
    }
  });

  it("does not repeat a full name inside one squad", () => {
    for (const seed of seeds) {
      const names = generateSquad(seed, "BY").map((p) => `${p.firstName} ${p.lastName}`);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("overallRating and realRating", () => {
  it("is the plain mean when all the weights of a position are used equally", () => {
    const flat = Object.fromEntries(attributesOf("MID").map((key) => [key, 60]));
    expect(overallRating("MID", flat)).toBe(60);
  });

  it("weighs the keeper's own attributes, not the outfield ones", () => {
    expect(
      overallRating("GK", {
        reflexes: 80,
        catching: 80,
        rushing_out: 80,
        kicking: 80,
        positioning: 80,
        composure: 80,
        agility: 80,
      }),
    ).toBe(80);
  });

  it("takes about 91% of the overall rating at the start (form, fitness, morale = 80)", () => {
    expect(realRating(60, { form: 80, fitness: 80, morale: 80 })).toBeCloseTo(54.8, 1);
  });

  it("is never above the overall rating and drops to 0.85³ at the bottom", () => {
    expect(realRating(70, { form: 100, fitness: 100, morale: 100 })).toBe(70);
    expect(realRating(100, { form: 0, fitness: 0, morale: 0 })).toBeCloseTo(61.4, 1);
  });
});

describe("generateYouth", () => {
  it("makes a 17–19 year old of the asked position with a low rating and room to grow", () => {
    for (const position of ["GK", "DEF", "MID", "FWD"] as const) {
      for (let i = 0; i < 20; i += 1) {
        const youth = generateYouth(`y${i}`, position, "BY");
        expect(youth.position).toBe(position);
        expect(youth.age).toBeGreaterThanOrEqual(17);
        expect(youth.age).toBeLessThanOrEqual(19);
        expect(youth.ovr).toBeGreaterThanOrEqual(44);
        expect(youth.ovr).toBeLessThanOrEqual(52);
        expect(youth.potential).toBeGreaterThan(youth.ovr + 10);
        expect(overallRating(position, youth.attributes)).toBe(youth.ovr);
      }
    }
  });

  it("is the same for the same seed", () => {
    expect(generateYouth("same", "MID", "BY")).toEqual(generateYouth("same", "MID", "BY"));
  });
});
