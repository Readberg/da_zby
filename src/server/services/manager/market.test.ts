import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import { nominalValue } from "@/lib/manager/economy";
import { buyFreeAgent, getFinance, getMarket, runMarketPools } from "./market";
import { generateFreeAgent } from "./squad";

/** A query that answers with `data` (and `count`) whatever is chained on it. */
function chain(data: unknown, count?: number): unknown {
  const target: unknown = new Proxy(() => {}, {
    get: (_, key) =>
      key === "then"
        ? (resolve: (value: unknown) => void) => resolve({ data, count, error: null })
        : () => target,
  });
  return target;
}

const CLUB = { id: "club-1", league_id: "league-1", budget: 9500 };

function client(tables: Record<string, unknown>) {
  return { from: (table: string) => tables[table] ?? chain([]) } as never;
}

describe("getFinance", () => {
  it("adds up what the squad costs and lists the ledger newest first", async () => {
    const squad = Array.from({ length: 20 }, () => ({ ovr: 60, age: 24 }));
    const finance = await getFinance(
      client({
        mgr_clubs: chain(CLUB),
        mgr_players: chain(squad),
        mgr_transactions: chain([
          {
            id: 2,
            amount: -100,
            reason: "wages",
            balance_after: 9500,
            created_at: "2026-11-20T07:05:00Z",
          },
          {
            id: 1,
            amount: 20,
            reason: "base",
            balance_after: 9600,
            created_at: "2026-11-20T07:05:00Z",
          },
        ]),
      }),
      "u1",
    );
    expect(finance.budget).toBe(9500);
    expect(finance.squadNominal).toBe(20_000);
    expect(finance.wagePerRound).toBe(100);
    expect(finance.transactions.map((t) => [t.reason, t.amount, t.balanceAfter])).toEqual([
      ["wages", -100, 9500],
      ["base", 20, 9600],
    ]);
  });

  it("is 404 for a visitor without a club", async () => {
    await expect(getFinance(client({ mgr_clubs: chain(null) }), "u1")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("getMarket", () => {
  const pool = [
    { id: "p1", first_name: "Иван", last_name: "Новик", position: "MID", age: 24, ovr: 60 },
    { id: "p2", first_name: "Олег", last_name: "Рудый", position: "FWD", age: 19, ovr: 65 },
  ];

  it("is closed before 10 played matches and shows the price of every free player", async () => {
    const market = await getMarket(
      client({ mgr_clubs: chain(CLUB), mgr_matches: chain(null, 9), mgr_players: chain(pool, 20) }),
      "u1",
    );
    expect(market.open).toBe(false);
    expect(market.matchesPlayed).toBe(9);
    expect(market.matchesNeeded).toBe(10);
    expect(market.players.map((p) => p.price)).toEqual([
      nominalValue(60, 24),
      nominalValue(65, 19),
    ]);
  });

  it("opens with the 10th played match", async () => {
    const market = await getMarket(
      client({
        mgr_clubs: chain(CLUB),
        mgr_matches: chain(null, 10),
        mgr_players: chain(pool, 20),
      }),
      "u1",
    );
    expect(market.open).toBe(true);
    expect(market.squadSize).toBe(20);
    expect(market.squadMax).toBe(23);
  });

  it("is closed for a club that has no league yet", async () => {
    const market = await getMarket(
      client({
        mgr_clubs: chain({ ...CLUB, league_id: null }),
        mgr_matches: chain(null, 30),
        mgr_players: chain([], 20),
      }),
      "u1",
    );
    expect(market.open).toBe(false);
    expect(market.players).toEqual([]);
  });
});

describe("buyFreeAgent", () => {
  it("returns the budget after the purchase", async () => {
    const rpc = vi.fn(async () => ({ data: 8500, error: null }));
    expect(await buyFreeAgent({ rpc } as never, "u1", "p1")).toEqual({ budget: 8500 });
    expect(rpc).toHaveBeenCalledWith("mgr_buy_free_agent", { p_user: "u1", p_player: "p1" });
  });

  it.each([
    ["manager.market_closed", 409, "manager.market_closed"],
    ["manager.player_unavailable", 409, "manager.player_unavailable"],
    ["manager.squad_full", 409, "manager.squad_full"],
    ["manager.no_money", 409, "manager.no_money"],
    ["manager.pool_by_bids", 409, "manager.pool_by_bids"],
    ["manager.club_unknown", 404, "api.not_found"],
  ])("maps the database refusal %s to %i", async (message, status, code) => {
    const rpc = vi.fn(async () => ({ data: null, error: { message } }));
    const result = buyFreeAgent({ rpc } as never, "u1", "p1");
    await expect(result).rejects.toMatchObject({ status, code });
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });
});

describe("runMarketPools", () => {
  const now = new Date("2026-12-03T10:00:00Z");

  function admin(leagues: { id: string; pool_month: string | null }[]) {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    return { rpc, from: () => chain(leagues) } as never as Parameters<typeof runMarketPools>[0] & {
      rpc: ReturnType<typeof vi.fn>;
    };
  }

  it("adds 30 free players to every league that has none for this month", async () => {
    const db = admin([
      { id: "l1", pool_month: "2026-11" },
      { id: "l2", pool_month: null },
      { id: "l3", pool_month: "2026-12" },
    ]);
    expect(await runMarketPools(db, now)).toBe(2);
    const calls = (db as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls as [
      string,
      { p_league: string; p_month: string; p_players: unknown[] },
    ][];
    expect(calls.map(([, args]) => args.p_league)).toEqual(["l1", "l2"]);
    for (const [name, args] of calls) {
      expect(name).toBe("mgr_add_pool");
      expect(args.p_month).toBe("2026-12");
      expect(args.p_players).toHaveLength(30);
    }
  });

  it("makes the same pool for the same league and month (two runners agree)", async () => {
    const first = admin([{ id: "l1", pool_month: null }]);
    const second = admin([{ id: "l1", pool_month: null }]);
    await runMarketPools(first, now);
    await runMarketPools(second, now);
    const payload = (db: unknown) =>
      (db as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls[0]?.[1];
    expect(payload(first)).toEqual(payload(second));
  });

  it("does not count a month that another runner added first", async () => {
    const rpc = vi.fn(async () => ({ data: false, error: null }));
    const db = { rpc, from: () => chain([{ id: "l1", pool_month: null }]) } as never;
    expect(await runMarketPools(db, now)).toBe(0);
  });
});

describe("generateFreeAgent", () => {
  it("makes players of every position with a rating of 45–75 and an age of 17–36", () => {
    const positions = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      const p = generateFreeAgent(`fa-${i}`, "BY");
      positions.add(p.position);
      expect(p.ovr).toBeGreaterThanOrEqual(45);
      expect(p.ovr).toBeLessThanOrEqual(75);
      expect(p.age).toBeGreaterThanOrEqual(17);
      expect(p.age).toBeLessThanOrEqual(36);
      expect(p.potential).toBeGreaterThanOrEqual(p.ovr);
    }
    expect([...positions].sort()).toEqual(["DEF", "FWD", "GK", "MID"]);
  });

  it("is the same for the same seed", () => {
    expect(generateFreeAgent("same", "BY")).toEqual(generateFreeAgent("same", "BY"));
  });
});
