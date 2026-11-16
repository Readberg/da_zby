import { describe, expect, it } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import { getPlayerStats, getScorers, sumLines, toStatLine } from "./stats";

function chain(data: unknown): unknown {
  const target: unknown = new Proxy(() => {}, {
    get: (_, key) =>
      key === "then"
        ? (resolve: (value: unknown) => void) => resolve({ data, error: null })
        : () => target,
  });
  return target;
}
function client(tables: Record<string, unknown>) {
  return { from: (table: string) => tables[table] ?? chain([]) } as never;
}

const ME = { id: "club-1", name: "Мой", league_id: "league-1", budget: 0 };
const ROW = {
  matches: 10,
  goals: 4,
  assists: 2,
  shots: 20,
  shots_on_target: 9,
  injuries: 1,
  clean_sheets: 0,
};

describe("stat lines", () => {
  it("maps a row and adds lines up", () => {
    const line = toStatLine(ROW);
    expect(line).toEqual({
      matches: 10,
      goals: 4,
      assists: 2,
      shots: 20,
      shotsOnTarget: 9,
      injuries: 1,
      cleanSheets: 0,
    });
    expect(sumLines([line, line]).goals).toBe(8);
    expect(sumLines([]).matches).toBe(0);
  });
});

describe("getPlayerStats", () => {
  const player = {
    id: "p1",
    first_name: "Иван",
    last_name: "Иванов",
    position: "FWD",
    club_id: "c2",
  };

  it("gives seasons and the career of a player of my league", async () => {
    const stats = await getPlayerStats(
      client({
        mgr_clubs: chain({ ...ME, league_id: "league-1" }),
        mgr_players: chain(player),
        mgr_player_stats: chain([
          { ...ROW, season: 2, club: { name: "Динамо" } },
          { ...ROW, season: 1, club: { name: "Динамо" } },
        ]),
      }),
      "u1",
      "p1",
    );
    expect(stats.name).toBe("Иван Иванов");
    expect(stats.seasons.map((s) => s.season)).toEqual([2, 1]);
    expect(stats.career.goals).toBe(8);
  });

  it("is 404 for a player without a club (a free agent)", async () => {
    await expect(
      getPlayerStats(
        client({
          mgr_clubs: chain(ME),
          mgr_players: chain({ ...player, club_id: null }),
        }),
        "u1",
        "p1",
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getScorers", () => {
  it("lists scorers and marks my own club", async () => {
    const view = await getScorers(
      client({
        mgr_clubs: chain(ME),
        mgr_leagues: chain({ season: 3 }),
        mgr_player_stats: chain([
          {
            ...ROW,
            player_id: "p1",
            player: { first_name: "Иван", last_name: "Иванов", position: "FWD" },
            club: { id: "club-1", name: "Мой" },
          },
          { ...ROW, player_id: "p2", player: null, club: { id: "c9", name: "Чужой" } },
        ]),
      }),
      "u1",
    );
    expect(view.season).toBe(3);
    expect(view.scorers).toHaveLength(1);
    expect(view.scorers[0]).toMatchObject({ playerId: "p1", isMine: true, goals: 4 });
  });

  it("is empty while the club has no league", async () => {
    const view = await getScorers(client({ mgr_clubs: chain({ ...ME, league_id: null }) }), "u1");
    expect(view).toEqual({ season: null, scorers: [] });
  });
});
