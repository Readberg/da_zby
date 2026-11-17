import { describe, expect, it } from "vitest";
import { computeForm, resultFor } from "./table";

const m = (homeClubId: string, awayClubId: string, homeGoals: number, awayGoals: number) => ({
  homeClubId,
  awayClubId,
  homeGoals,
  awayGoals,
});

describe("resultFor", () => {
  it("tells a win, a draw and a loss", () => {
    expect([resultFor(2, 1), resultFor(1, 1), resultFor(0, 3)]).toEqual(["W", "D", "L"]);
  });
});

describe("computeForm", () => {
  it("collects the results of both sides, oldest first", () => {
    const form = computeForm([m("a", "b", 2, 0), m("b", "a", 1, 1)]);
    expect(form.get("a")).toEqual(["W", "D"]);
    expect(form.get("b")).toEqual(["L", "D"]);
  });

  it("keeps only the last five", () => {
    const matches = [m("a", "b", 0, 1), ...Array.from({ length: 5 }, () => m("a", "b", 1, 0))];
    expect(computeForm(matches).get("a")).toEqual(["W", "W", "W", "W", "W"]);
  });
});
