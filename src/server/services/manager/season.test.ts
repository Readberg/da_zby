import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import { generateSquad } from "./squad";
import {
  closeFinishedSeasons,
  openReadySeasons,
  requestFriendly,
  runPreseasonDays,
} from "./season";

/** A query that answers with `data` whatever is chained on it (the fake of one table). */
function chain(data: unknown): unknown {
  const target: unknown = new Proxy(() => {}, {
    get: (_, key) =>
      key === "then"
        ? (resolve: (value: unknown) => void) => resolve({ data, error: null })
        : () => target,
  });
  return target;
}

const LEAGUE = "league-1";

describe("closeFinishedSeasons", () => {
  function admin(options: {
    retirees: { id: string; club_id: string; position: string }[];
    closes?: boolean;
  }) {
    const rpc = vi.fn(async (name: string) => {
      if (name === "mgr_leagues_to_close") return { data: [LEAGUE], error: null };
      return { data: options.closes ?? true, error: null };
    });
    const from = (table: string) => {
      if (table === "mgr_leagues") return chain({ season: 1 });
      if (table === "mgr_clubs")
        return chain([
          { id: "a", is_bot: false },
          { id: "b", is_bot: true },
        ]);
      return chain(options.retirees);
    };
    return { rpc, from } as never as Parameters<typeof closeFinishedSeasons>[0] & {
      rpc: ReturnType<typeof vi.fn>;
    };
  }

  it("replaces every player who retires by a young one of the same position, in the same club", async () => {
    const retirees = [
      { id: "p1", club_id: "a", position: "GK" },
      { id: "p2", club_id: "b", position: "FWD" },
    ];
    const db = admin({ retirees });
    expect(await closeFinishedSeasons(db)).toBe(1);
    const call = (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls.find(
      ([name]) => name === "mgr_close_season",
    ) as [string, { p_league: string; p_replacements: Record<string, unknown>[] }];
    const replacements = call[1].p_replacements;
    expect(call[1].p_league).toBe(LEAGUE);
    expect(replacements.map((r) => [r.club_id, r.position])).toEqual([
      ["a", "GK"],
      ["b", "FWD"],
    ]);
    for (const youth of replacements) {
      expect(youth.age as number).toBeGreaterThanOrEqual(17);
      expect(youth.age as number).toBeLessThanOrEqual(19);
      expect(youth.ovr as number).toBeLessThan(55);
      expect(youth.potential as number).toBeGreaterThan(youth.ovr as number);
    }
  });

  it("closes a league with nobody retiring too (an empty list)", async () => {
    const db = admin({ retirees: [] });
    expect(await closeFinishedSeasons(db)).toBe(1);
    const call = (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls.find(
      ([name]) => name === "mgr_close_season",
    ) as [string, { p_replacements: unknown[] }];
    expect(call[1].p_replacements).toEqual([]);
  });

  it("does not count a season that another runner closed first", async () => {
    expect(await closeFinishedSeasons(admin({ retirees: [], closes: false }))).toBe(0);
  });

  it("makes the same youth every time for the same player (two runners agree)", async () => {
    const retirees = [{ id: "p1", club_id: "a", position: "DEF" }];
    const first = admin({ retirees });
    const second = admin({ retirees });
    await closeFinishedSeasons(first);
    await closeFinishedSeasons(second);
    const payload = (db: unknown) =>
      (db as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls.find(
        ([name]) => name === "mgr_close_season",
      )?.[1];
    expect(payload(first)).toEqual(payload(second));
  });
});

describe("openReadySeasons", () => {
  const twenty = Array.from({ length: 20 }, (_, i) => ({
    id: `club-${String(i).padStart(2, "0")}`,
    is_bot: i > 0,
  }));

  function admin(clubs = twenty) {
    const rpc = vi.fn(async (name: string) =>
      name === "mgr_leagues_to_open"
        ? { data: [LEAGUE], error: null }
        : { data: true, error: null },
    );
    const from = (table: string) => (table === "mgr_leagues" ? chain({ season: 1 }) : chain(clubs));
    return { rpc, from } as never as Parameters<typeof openReadySeasons>[0] & {
      rpc: ReturnType<typeof vi.fn>;
    };
  }

  it("draws a schedule of 38 rounds for the 20 clubs of the league", async () => {
    const db = admin();
    expect(await openReadySeasons(db)).toBe(1);
    const call = (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls.find(
      ([name]) => name === "mgr_open_season",
    ) as [string, { p_matches: { round: number; home_club_id: string; away_club_id: string }[] }];
    const matches = call[1].p_matches;
    expect(matches).toHaveLength(380);
    expect(new Set(matches.map((m) => m.round)).size).toBe(38);
    for (let round = 1; round <= 38; round += 1) {
      const clubs = matches
        .filter((m) => m.round === round)
        .flatMap((m) => [m.home_club_id, m.away_club_id]);
      expect(new Set(clubs).size).toBe(20);
    }
  });

  it("does not open a league that does not have 20 clubs", async () => {
    const db = admin(twenty.slice(0, 19));
    expect(await openReadySeasons(db)).toBe(0);
    expect(
      (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls.some(
        ([name]) => name === "mgr_open_season",
      ),
    ).toBe(false);
  });
});

describe("runPreseasonDays", () => {
  const club = { id: "a", is_bot: false };
  const rows = generateSquad("seed", "BY").map((p, i) => ({
    id: `p${i}`,
    club_id: "a",
    first_name: p.firstName,
    last_name: p.lastName,
    position: p.position,
    age: p.age,
    ovr: p.ovr,
    form: 80,
    fitness: 80,
    morale: 80,
    idle_rounds: 0,
    injured_until: null,
    training_focus: null,
    retire_after_season: false,
    hidden: { potential: 90 },
    attrs: Object.entries(p.attributes).map(([attribute, value]) => ({ attribute, value })),
  }));

  function admin(league: { last_tick_at: string; preseason_ends_at: string }) {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const from = (table: string) => {
      if (table === "mgr_leagues") return chain([{ id: LEAGUE, ...league }]);
      if (table === "mgr_clubs") return chain([club]);
      return chain(rows);
    };
    return { rpc, from } as never as Parameters<typeof runPreseasonDays>[0] & {
      rpc: ReturnType<typeof vi.fn>;
    };
  }

  it("applies every preseason day that has come and not more", async () => {
    // The season ended on 20 Nov 07:00 UTC, the preseason lasts until 26 Nov 07:00.
    const db = admin({
      last_tick_at: "2026-11-20T07:00:00Z",
      preseason_ends_at: "2026-11-26T07:00:00Z",
    });
    const applied = await runPreseasonDays(db, new Date("2026-11-23T08:00:00Z"));
    expect(applied).toBe(3);
    const days = (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls.map(
      ([, args]) => (args as { p_day: string }).p_day,
    );
    expect(days).toEqual([
      "2026-11-21T07:00:00.000Z",
      "2026-11-22T07:00:00.000Z",
      "2026-11-23T07:00:00.000Z",
    ]);
  });

  it("rests everybody: fitness goes up by 5", async () => {
    const db = admin({
      last_tick_at: "2026-11-20T07:00:00Z",
      preseason_ends_at: "2026-11-26T07:00:00Z",
    });
    await runPreseasonDays(db, new Date("2026-11-21T08:00:00Z"));
    const [, args] = (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls[0] as [
      string,
      { p_effects: { fitness: number }[] },
    ];
    expect(args.p_effects).toHaveLength(20);
    expect(args.p_effects.every((e) => e.fitness === 85)).toBe(true);
  });

  it("does nothing before the first day is due or on the day the season starts", async () => {
    const early = admin({
      last_tick_at: "2026-11-20T07:00:00Z",
      preseason_ends_at: "2026-11-26T07:00:00Z",
    });
    expect(await runPreseasonDays(early, new Date("2026-11-20T20:00:00Z"))).toBe(0);
    const end = admin({
      last_tick_at: "2026-11-25T07:00:00Z",
      preseason_ends_at: "2026-11-26T07:00:00Z",
    });
    expect(await runPreseasonDays(end, new Date("2026-11-26T08:00:00Z"))).toBe(0);
  });
});

describe("requestFriendly", () => {
  it("returns the new match", async () => {
    const rpc = vi.fn(async () => ({ data: "m-1", error: null }));
    expect(await requestFriendly({ rpc } as never, "u1")).toEqual({ matchId: "m-1" });
    expect(rpc).toHaveBeenCalledWith("mgr_request_friendly", { p_user: "u1" });
  });

  it.each([
    ["manager.friendly_unavailable", 409, "manager.friendly_unavailable"],
    ["manager.friendly_busy", 409, "manager.friendly_busy"],
    ["manager.club_unknown", 404, "api.not_found"],
  ])("maps the database refusal %s to %i", async (message, status, code) => {
    const rpc = vi.fn(async () => ({ data: null, error: { message } }));
    const result = requestFriendly({ rpc } as never, "u1");
    await expect(result).rejects.toMatchObject({ status, code });
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });
});
