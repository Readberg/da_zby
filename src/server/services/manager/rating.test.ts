import { describe, expect, it } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import { aboveFilter, getRating, pgrstQuote } from "./rating";

const ME = { id: "c2", name: "Мой", elo: 1100, league_id: "league-1" };
const ROWS = [
  {
    id: "c1",
    name: "Первый",
    elo: 1200,
    elo_peak: 1250,
    primary_color: "#111111",
    secondary_color: "#eeeeee",
    logo_path: null,
    league: { number: 2 },
  },
  {
    id: "c2",
    name: "Мой",
    elo: 1100,
    elo_peak: 1100,
    primary_color: "#222222",
    secondary_color: "#dddddd",
    logo_path: null,
    league: { number: 1 },
  },
];

/** A query builder that answers by what was asked: the page (range), one club, or a count. */
function client(opts: { me: unknown; above?: number; total?: number }) {
  const calls: Array<[string, unknown[]]> = [];
  const make = (): unknown => {
    const seen: string[] = [];
    const target: unknown = new Proxy(() => {}, {
      get: (_, key: string) => {
        if (key === "then") {
          return (resolve: (v: unknown) => void) => {
            if (seen.includes("range"))
              resolve({ data: ROWS, count: opts.total ?? 2, error: null });
            else if (seen.includes("maybeSingle") || seen.includes("single"))
              resolve({ data: opts.me, error: null });
            else resolve({ data: null, count: opts.above ?? 0, error: null });
          };
        }
        return (...args: unknown[]) => {
          seen.push(key);
          calls.push([key, args]);
          return target;
        };
      },
    });
    return target;
  };
  return { db: { from: () => make() } as never, calls };
}

describe("getRating", () => {
  it("lists real clubs with the place by the page, marks mine and gives my place", async () => {
    const { db } = client({ me: ME, above: 1, total: 41 });
    const rating = await getRating(db, "u1", { scope: "all", page: 2, pageSize: 20 });
    expect(rating.total).toBe(41);
    expect(rating.items.map((r) => r.rank)).toEqual([21, 22]);
    expect(rating.items.map((r) => r.isMine)).toEqual([false, true]);
    expect(rating.items[0]).toMatchObject({ elo: 1200, eloPeak: 1250, leagueNumber: 2 });
    expect(rating.mine).toEqual({ rank: 2, elo: 1100 });
  });

  it("never asks for bots and orders by Elo, then name, then id", async () => {
    const { db, calls } = client({ me: ME });
    await getRating(db, "u1", { scope: "all", page: 1, pageSize: 50 });
    expect(calls).toContainEqual(["eq", ["is_bot", false]]);
    expect(calls.filter(([k]) => k === "order").map(([, a]) => a[0])).toEqual([
      "elo",
      "name",
      "id",
    ]);
    expect(calls).toContainEqual(["range", [0, 49]]);
  });

  it("filters my league", async () => {
    const { db, calls } = client({ me: ME });
    await getRating(db, "u1", { scope: "league", page: 1, pageSize: 50 });
    expect(calls).toContainEqual(["eq", ["league_id", "league-1"]]);
  });

  it("is 404 without a club", async () => {
    const { db } = client({ me: null });
    await expect(
      getRating(db, "u1", { scope: "all", page: 1, pageSize: 50 }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("the filter of clubs above mine", () => {
  it("quotes a value and escapes quotes and backslashes", () => {
    expect(pgrstQuote("Динамо")).toBe('"Динамо"');
    expect(pgrstQuote('a"b\\c')).toBe('"a\\"b\\\\c"');
  });

  it("keeps a name with special characters inside one quoted value", () => {
    const filter = aboveFilter({ elo: 1000, name: 'x"),id.gt.0,and(name.eq."', id: "c1" });
    expect(filter).toContain('name.lt."x\\"),id.gt.0,and(name.eq.\\""');
  });
});
