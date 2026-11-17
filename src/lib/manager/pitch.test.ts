import { describe, expect, it } from "vitest";
import { FORMATIONS, formationCounts } from "./formations";
import {
  assign,
  benchOf,
  lineupIds,
  pitchSlots,
  place,
  reshape,
  slotOf,
  type PitchPlayer,
} from "./pitch";

const counts = { GK: 2, DEF: 7, MID: 7, FWD: 4 } as const;
const squad: PitchPlayer[] = (["GK", "DEF", "MID", "FWD"] as const).flatMap((position) =>
  Array.from({ length: counts[position] }, (_, i) => ({
    id: `${position}${i}`,
    position,
    real: 60 - i,
  })),
);

describe("pitchSlots", () => {
  it("has 11 places: a goalkeeper and the lines of the formation, the goal at the bottom", () => {
    for (const formation of FORMATIONS) {
      const slots = pitchSlots(formation);
      expect(slots).toHaveLength(11);
      const need = formationCounts(formation);
      for (const position of ["GK", "DEF", "MID", "FWD"] as const) {
        expect(slots.filter((s) => s.position === position)).toHaveLength(need[position]);
      }
      const y = (p: string) => slots.find((s) => s.position === p)!.y;
      expect(y("GK")).toBeGreaterThan(y("DEF"));
      expect(y("DEF")).toBeGreaterThan(y("MID"));
      expect(y("MID")).toBeGreaterThan(y("FWD"));
    }
  });

  it("spreads a line evenly from left to right, inside the pitch", () => {
    const line = pitchSlots("4-4-2").filter((s) => s.position === "DEF");
    expect(line.map((s) => s.x)).toEqual([20, 40, 60, 80]);
  });
});

describe("pitchSlots: formations with several rows", () => {
  const rowsOf = (formation: Parameters<typeof pitchSlots>[0], position: string) => {
    const ys = new Map<number, number>();
    for (const s of pitchSlots(formation).filter((p) => p.position === position)) {
      ys.set(s.y, (ys.get(s.y) ?? 0) + 1);
    }
    return [...ys.entries()].sort((a, b) => b[0] - a[0]).map(([, n]) => n);
  };

  it("draws the rows of the formation from the own goal forward", () => {
    expect(rowsOf("4-2-3-1", "MID")).toEqual([2, 3]);
    expect(rowsOf("4-1-4-1", "MID")).toEqual([1, 4]);
    expect(rowsOf("3-4-1-2", "MID")).toEqual([4, 1]);
    expect(rowsOf("4-4-1-1", "FWD")).toEqual([1, 1]);
    expect(rowsOf("4-4-2", "MID")).toEqual([4]);
  });

  it("keeps the lines in order and every place inside the pitch, with unique ids", () => {
    for (const formation of FORMATIONS) {
      const slots = pitchSlots(formation);
      expect(new Set(slots.map((s) => s.id)).size).toBe(11);
      const lowest = (p: string) =>
        Math.min(...slots.filter((s) => s.position === p).map((s) => s.y));
      const highest = (p: string) =>
        Math.max(...slots.filter((s) => s.position === p).map((s) => s.y));
      expect(highest("DEF")).toBeLessThan(slots.find((s) => s.position === "GK")!.y);
      expect(lowest("DEF")).toBeGreaterThan(highest("MID"));
      expect(lowest("MID")).toBeGreaterThan(highest("FWD"));
      for (const s of slots) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(100);
        expect(s.y).toBeGreaterThan(0);
        expect(s.y).toBeLessThan(100);
      }
    }
  });
});

describe("assign", () => {
  it("takes the preferred players first, then the best of the position", () => {
    const assignment = assign("4-4-2", ["DEF5", "GK1"], squad);
    expect(assignment["GK-0"]).toBe("GK1");
    expect(assignment["DEF-0"]).toBe("DEF5");
    expect(assignment["DEF-1"]).toBe("DEF0");
    expect(Object.keys(assignment)).toHaveLength(11);
    expect(new Set(Object.values(assignment)).size).toBe(11);
  });

  it("never picks an injured player", () => {
    const hurt = squad.map((p) => (p.id === "GK0" ? { ...p, injured: true } : p));
    expect(assign("4-4-2", ["GK0"], hurt)["GK-0"]).toBe("GK1");
  });
});

describe("place", () => {
  const base = assign("4-4-2", [], squad);

  it("puts a bench player of the same position on the pitch and sends the other to the bench", () => {
    const next = place("4-4-2", base, squad, "DEF-1", "DEF6")!;
    expect(next["DEF-1"]).toBe("DEF6");
    expect(slotOf(next, "DEF1")).toBeNull();
    expect(benchOf(next, squad).map((p) => p.id)).toContain("DEF1");
  });

  it("swaps two players of the pitch within a line", () => {
    const next = place("4-4-2", base, squad, "DEF-3", "DEF0")!;
    expect(next["DEF-3"]).toBe("DEF0");
    expect(next["DEF-0"]).toBe("DEF3");
  });

  it("refuses a player of another position", () => {
    expect(place("4-4-2", base, squad, "DEF-0", "MID6")).toBeNull();
    expect(place("4-4-2", base, squad, "GK-0", "FWD3")).toBeNull();
  });

  it("refuses an injured player and an unknown place", () => {
    const hurt = squad.map((p) => (p.id === "DEF6" ? { ...p, injured: true } : p));
    expect(place("4-4-2", base, hurt, "DEF-0", "DEF6")).toBeNull();
    expect(place("4-4-2", base, squad, "DEF-9", "DEF6")).toBeNull();
  });

  it("changes nothing when the player is already there", () => {
    expect(place("4-4-2", base, squad, "DEF-0", "DEF0")).toBe(base);
  });

  it("always keeps 11 different players", () => {
    let current = base;
    for (const [slot, player] of [
      ["MID-2", "MID6"],
      ["FWD-0", "FWD3"],
      ["MID-0", "MID2"],
      ["GK-0", "GK1"],
    ] as const) {
      current = place("4-4-2", current, squad, slot, player)!;
      expect(new Set(Object.values(current)).size).toBe(11);
    }
  });
});

describe("reshape and lineupIds", () => {
  it("keeps the first players of each line when the formation changes and fills the rest from the bench", () => {
    const base = assign("4-4-2", [], squad);
    const next = reshape("3-5-2", base, squad, "4-4-2");
    expect(Object.keys(next)).toHaveLength(11);
    expect(next["DEF-0"]).toBe(base["DEF-0"]);
    expect(next["MID-4"]).toBeDefined();
    expect(pitchSlots("3-5-2").filter((s) => s.position === "DEF")).toHaveLength(3);
    expect(lineupIds("3-5-2", next)).toHaveLength(11);
  });

  it("lists the ids in the order of the places, the goalkeeper first", () => {
    const assignment = assign("4-3-3", [], squad);
    expect(lineupIds("4-3-3", assignment)[0]).toBe("GK0");
  });
});
