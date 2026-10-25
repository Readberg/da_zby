import { describe, expect, it } from "vitest";
import { placeChanges, type Standing } from "./place-change";

const s = (userId: string, points: number, exact = 0, outcome = 0, count = 3): Standing => ({
  userId,
  points,
  exactCount: exact,
  outcomeCount: outcome,
  predictionsCount: count,
});

describe("placeChanges", () => {
  it("shows who rose and who fell after the last tour", () => {
    // before: a 10, b 8, c 5; the last tour gave b +5, c +0, a +1
    const season = [s("a", 11), s("b", 13), s("c", 5)];
    const tour = [s("a", 1, 0, 0, 1), s("b", 5, 0, 0, 1), s("c", 0, 0, 0, 1)];
    const changes = placeChanges(season, tour);
    expect(changes.get("b")).toBe(1);
    expect(changes.get("a")).toBe(-1);
    expect(changes.get("c")).toBe(0);
  });

  it("has no change for someone whose first predictions are in the last tour", () => {
    const season = [s("a", 4, 0, 0, 2), s("n", 3, 0, 0, 1)];
    const tour = [s("a", 1, 0, 0, 1), s("n", 3, 0, 0, 1)];
    expect(placeChanges(season, tour).has("n")).toBe(false);
  });

  it("treats equal results as a shared place", () => {
    const season = [s("a", 5), s("b", 5)];
    const tour = [s("a", 5, 0, 0, 1), s("b", 5, 0, 0, 1)];
    expect([...placeChanges(season, tour).values()]).toEqual([0, 0]);
  });

  it("is empty without a graded tour", () => {
    expect(placeChanges([s("a", 3)], []).get("a")).toBe(0);
  });
});
