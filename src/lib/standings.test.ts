import { describe, expect, it } from "vitest";
import { computeStandings, type StandingsClub, type StandingsMatch } from "./standings";

const club = (id: string, name = id): StandingsClub => ({ id, name, logoUrl: null });
const A = club("a", "Алга");
const B = club("b", "Бета");
const C = club("c", "Вега");

let n = 0;
const played = (
  homeId: string,
  awayId: string,
  homeScore: number | null,
  awayScore: number | null,
  status: StandingsMatch["status"] = "finished",
): StandingsMatch => ({
  homeId,
  awayId,
  homeScore,
  awayScore,
  status,
  kickoffAt: `2026-03-${String(10 + n++).padStart(2, "0")}T15:00:00Z`,
});

describe("computeStandings", () => {
  it("lists every club of the season with zeros before the first match", () => {
    const rows = computeStandings([B, A], []);
    expect(rows.map((r) => [r.place, r.club.name, r.played, r.points])).toEqual([
      [1, "Алга", 0, 0],
      [1, "Бета", 0, 0],
    ]);
  });

  it("gives 3 points for a win, 1 for a draw and counts goals", () => {
    const rows = computeStandings([A, B, C], [played("a", "b", 2, 0), played("b", "c", 1, 1)]);
    const byName = Object.fromEntries(rows.map((r) => [r.club.name, r]));
    expect(byName["Алга"]).toMatchObject({
      played: 1,
      won: 1,
      points: 3,
      goalsFor: 2,
      goalsAgainst: 0,
      goalDiff: 2,
    });
    expect(byName["Бета"]).toMatchObject({ played: 2, lost: 1, drawn: 1, points: 1, goalDiff: -2 });
    expect(byName["Вега"]).toMatchObject({ played: 1, drawn: 1, points: 1, goalDiff: 0 });
  });

  it("orders by points, then goal difference, then goals scored, then name", () => {
    const rows = computeStandings(
      [A, B, C],
      [played("a", "b", 1, 0), played("c", "b", 3, 2), played("c", "a", 0, 0)],
    );
    // Алга: 4 pts (+1), Вега: 4 pts (+1, 3 scored) -> Вега ahead on goals scored.
    expect(rows.map((r) => r.club.name)).toEqual(["Вега", "Алга", "Бета"]);
  });

  it("shares a place between clubs equal in points, difference and goals", () => {
    const rows = computeStandings([A, B, C], [played("a", "b", 1, 1)]);
    expect(rows.map((r) => [r.club.name, r.place])).toEqual([
      ["Алга", 1],
      ["Бета", 1],
      ["Вега", 3],
    ]);
  });

  it("ignores matches that are not finished or have no score", () => {
    const rows = computeStandings(
      [A, B],
      [
        played("a", "b", null, null, "scheduled"),
        played("a", "b", 3, 0, "postponed"),
        played("a", "b", 3, 0, "cancelled"),
        played("a", "b", null, null, "finished"),
      ],
    );
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });

  it("skips a match of a club outside the season squad", () => {
    const rows = computeStandings([A, B], [played("a", "x", 5, 0)]);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });

  it("shows the latest five results, oldest first", () => {
    const matches = [
      played("a", "b", 1, 0),
      played("a", "b", 0, 0),
      played("b", "a", 2, 0),
      played("a", "b", 3, 0),
      played("a", "b", 1, 1),
      played("a", "b", 0, 1),
    ];
    const rows = computeStandings([A, B], matches);
    expect(rows.find((r) => r.club.id === "a")?.form).toEqual(["D", "L", "W", "D", "L"]);
  });
});
