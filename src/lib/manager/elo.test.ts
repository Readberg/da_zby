import { describe, expect, it } from "vitest";
import { ELO_START, eloAfter, eloExpected, eloK, eloSeasonEnd } from "./elo";

describe("elo", () => {
  it("expects a half from equal clubs and more for the stronger", () => {
    expect(eloExpected(1000, 1000)).toBe(0.5);
    expect(eloExpected(1400, 1000)).toBeCloseTo(0.909, 3);
    expect(eloExpected(1000, 1400)).toBeCloseTo(0.091, 3);
    expect(eloExpected(1200, 1000) + eloExpected(1000, 1200)).toBeCloseTo(1, 10);
  });

  it("moves the new club faster: K 24 for 20 matches, then 16", () => {
    expect(eloK(0)).toBe(24);
    expect(eloK(19)).toBe(24);
    expect(eloK(20)).toBe(16);
    expect(eloK(300)).toBe(16);
  });

  it("gives ±12 for a win and a defeat between equal new clubs", () => {
    expect(eloAfter(1000, 1000, 1, 0)).toBe(1012);
    expect(eloAfter(1000, 1000, 0, 0)).toBe(988);
    expect(eloAfter(1000, 1000, 0.5, 0)).toBe(1000);
  });

  it("a draw takes from the stronger and gives to the weaker", () => {
    expect(eloAfter(1012, 988, 0.5, 5)).toBe(1011);
    expect(eloAfter(988, 1012, 0.5, 5)).toBe(989);
  });

  it("an upset moves more than an expected win; a settled club moves less", () => {
    const upset = eloAfter(1000, 1400, 1, 0) - 1000;
    const expected = eloAfter(1400, 1000, 1, 0) - 1400;
    expect(upset).toBe(22);
    expect(expected).toBe(2);
    expect(eloAfter(1000, 1000, 1, 20) - 1000).toBe(8);
  });

  it("pulls the rating 20% back to 1000 at the end of a season", () => {
    expect(eloSeasonEnd(1300)).toBe(1240);
    expect(eloSeasonEnd(900)).toBe(920);
    expect(eloSeasonEnd(ELO_START)).toBe(ELO_START);
  });
});
