import { describe, expect, it, vi } from "vitest";
import {
  extendContract,
  getContracts,
  releaseExpiredContracts,
  terminateContract,
} from "./contracts";
import {
  acceptTrade,
  closeTrade,
  expireTrades,
  getClubSquad,
  getTrades,
  proposeTrade,
} from "./trade";

/** A query that answers with `data` (and `count`) whatever is chained on it; `maybeSingle` gives `single`. */
function chain(data: unknown, count?: number, single?: unknown): unknown {
  const target: unknown = new Proxy(() => {}, {
    get: (_, key) =>
      key === "then"
        ? (resolve: (value: unknown) => void) => resolve({ data, count, error: null })
        : key === "maybeSingle"
          ? () => Promise.resolve({ data: single ?? data, error: null })
          : () => target,
  });
  return target;
}

function client(tables: Record<string, unknown>, rpc = vi.fn()) {
  return { from: (table: string) => tables[table] ?? chain([]), rpc } as never;
}

const CLUB = { id: "club-1", name: "Сокол", league_id: "league-1", budget: 9500 };
const NOW = new Date("2026-11-25T10:00:00Z");

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  first_name: "Имя" + id,
  last_name: "Фамилия" + id,
  position: "MID",
  age: 24,
  ovr: 60,
  wage: 5,
  contract_until: 2,
  contract_offer_season: null,
  tradable_after: null,
  retire_after_season: false,
  ...over,
});

describe("getContracts", () => {
  it("shows the wage, the rounds left and why a player cannot be put up", async () => {
    const squad = Array.from({ length: 20 }, (_, i) => row(`p${i}`));
    squad[1] = row("p1", { contract_until: 1 }); // over
    squad[2] = row("p2", { tradable_after: "2026-11-30T00:00:00Z" }); // bought this week
    squad[3] = row("p3", { retire_after_season: true });
    squad[4] = row("p4", { contract_until: 4 }); // too long to offer a new one
    squad[5] = row("p5", { contract_offer_season: 2 }); // offered this season
    const contracts = await getContracts(
      client({
        mgr_clubs: chain(CLUB),
        mgr_leagues: chain({ season: 2 }),
        mgr_players: chain(squad),
        mgr_matches: chain(null, 10),
        mgr_auctions: chain([{ player_id: "p6" }]),
      }),
      "u1",
      NOW,
    );
    const by = (id: string) => contracts.players.find((p) => p.id === id)!;
    expect(contracts.season).toBe(2);
    expect(contracts.squadSize).toBe(20);
    expect(by("p0")).toMatchObject({ roundsLeft: 28, wage: 5, canSell: true, canExtend: true });
    expect(by("p0").breakPenalty).toBe(Math.round((28 * 5 * 2) / 3));
    expect(by("p1")).toMatchObject({
      roundsLeft: 0,
      sellBlock: "contract_ending",
      canExtend: false,
    });
    expect(by("p2")).toMatchObject({ sellBlock: "locked", canSell: false });
    expect(by("p3")).toMatchObject({ sellBlock: "retiring" });
    expect(by("p4")).toMatchObject({ roundsLeft: 104, canSell: true, canExtend: false });
    expect(by("p5")).toMatchObject({ canExtend: false });
    expect(by("p6")).toMatchObject({ onAuction: true, sellBlock: "on_auction" });
    expect(by("p0").priceMin).toBe(500);
  });

  it("blocks selling while the market is closed", async () => {
    const contracts = await getContracts(
      client({
        mgr_clubs: chain(CLUB),
        mgr_leagues: chain({ season: 1 }),
        mgr_players: chain([row("p0")]),
        mgr_matches: chain(null, 3),
      }),
      "u1",
      NOW,
    );
    expect(contracts.players[0]).toMatchObject({ canSell: false, sellBlock: "market_closed" });
  });
});

describe("the calls of the database", () => {
  it("offers a contract and passes on the answer", async () => {
    const rpc = vi.fn(async () => ({ data: "refused", error: null }));
    expect(await extendContract(client({}, rpc), "u1", { playerId: "p", seasons: 2 })).toEqual({
      result: "refused",
    });
    expect(rpc).toHaveBeenCalledWith("mgr_extend_contract", {
      p_user: "u1",
      p_player: "p",
      p_seasons: 2,
    });
  });

  it.each([
    ["manager.offer_used", 409],
    ["manager.contract_invalid", 422],
    ["manager.player_unavailable", 409],
  ])("maps %s of an offer to %i", async (message, status) => {
    const rpc = vi.fn(async () => ({ data: null, error: { message } }));
    await expect(
      extendContract(client({}, rpc), "u1", { playerId: "p", seasons: 1 }),
    ).rejects.toMatchObject({ status, code: message });
  });

  it("breaks a contract and reports the penalty", async () => {
    const rpc = vi.fn(async () => ({ data: 1250, error: null }));
    expect(await terminateContract(client({}, rpc), "u1", "p")).toEqual({ penalty: 1250 });
    const refused = vi.fn(async () => ({ data: null, error: { message: "manager.squad_min" } }));
    await expect(terminateContract(client({}, refused), "u1", "p")).rejects.toMatchObject({
      status: 409,
      code: "manager.squad_min",
    });
  });

  it("releases the expired contracts of every league and survives a failing one", async () => {
    const rpc = vi.fn(async (_: string, args: { p_league: string }) =>
      args.p_league === "l1"
        ? { data: null, error: { message: "boom" } }
        : { data: 4, error: null },
    );
    const db = client({ mgr_leagues: chain([{ id: "l1" }, { id: "l2" }, { id: "l3" }]) }, rpc);
    expect(await releaseExpiredContracts(db)).toBe(8);
  });
});

describe("trades", () => {
  const tradeRow = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    league_id: "league-1",
    from_club_id: "club-2",
    to_club_id: "club-1",
    give_ids: ["g1"],
    take_ids: ["t1"],
    cash: 300,
    status: "pending",
    created_at: "2026-11-25T08:00:00Z",
    expires_at: "2026-11-27T08:00:00Z",
    resolved_at: null,
    ...over,
  });

  it("lists offers with their players and shows an overdue one as expired", async () => {
    const trades = await getTrades(
      client({
        mgr_clubs: chain(
          [
            { id: "club-1", name: "Сокол" },
            { id: "club-2", name: "Торпедо" },
          ],
          undefined,
          CLUB,
        ),
        mgr_matches: chain(null, 12),
        mgr_trades: chain([
          tradeRow("x1"),
          tradeRow("x2", {
            expires_at: "2026-11-25T09:00:00Z",
            from_club_id: "club-1",
            to_club_id: "club-2",
          }),
        ]),
        mgr_players: chain([row("g1"), row("t1")]),
        mgr_leagues: chain({ season: 2 }),
        mgr_auctions: chain([]),
      }),
      "u1",
      NOW,
    );
    expect(trades.open).toBe(true);
    const [first, second] = trades.trades;
    expect(first).toMatchObject({ incoming: true, status: "pending", cash: 300 });
    expect(first?.give.map((p) => p.id)).toEqual(["g1"]);
    expect(second).toMatchObject({ incoming: false, status: "expired" });
    expect(trades.squad.length).toBeGreaterThan(0);
  });

  /** The first club read is mine, the second the other one. */
  function twoClubs(other: Record<string, unknown>, extra: Record<string, unknown>) {
    const reads = [CLUB, other];
    let i = 0;
    return {
      from: (table: string) =>
        table === "mgr_clubs" ? chain(null, undefined, reads[i++]) : (extra[table] ?? chain([])),
      rpc: vi.fn(),
    } as never;
  }

  it("marks the players of another club that cannot be exchanged now", async () => {
    const squad = await getClubSquad(
      twoClubs(
        { id: "club-2", name: "Торпедо", league_id: "league-1", user_id: "u2" },
        {
          mgr_leagues: chain({ season: 2 }),
          mgr_players: chain([
            row("a"),
            row("b", { tradable_after: "2026-11-30T00:00:00Z" }),
            row("c", { contract_until: 1 }),
          ]),
          mgr_matches: chain(null, 10),
          mgr_auctions: chain([]),
        },
      ),
      "u1",
      "club-2",
      NOW,
    );
    expect(squad.players.map((p) => p.locked)).toEqual([false, true, true]);
  });

  it("is 404 for a club of another league", async () => {
    await expect(
      getClubSquad(
        twoClubs({ id: "club-9", name: "Чужой", league_id: "league-9", user_id: "u9" }, {}),
        "u1",
        "club-9",
        NOW,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("proposes, accepts, declines and withdraws through the database", async () => {
    const rpc = vi.fn(async (name: string) =>
      name === "mgr_propose_trade"
        ? { data: "t1", error: null }
        : name === "mgr_close_trade"
          ? { data: true, error: null }
          : { data: null, error: null },
    );
    const db = client({}, rpc);
    expect(
      await proposeTrade(db, "u1", { toClubId: "c2", give: ["a"], take: ["b"], cash: -100 }),
    ).toEqual({ tradeId: "t1" });
    expect(await acceptTrade(db, "u1", "t1")).toEqual({ done: true });
    expect(await closeTrade(db, "u1", "t1", "decline")).toEqual({ done: true });
    expect(rpc).toHaveBeenCalledWith("mgr_close_trade", {
      p_user: "u1",
      p_trade: "t1",
      p_action: "decline",
    });
  });

  it.each([
    ["manager.squad_size", 409],
    ["manager.deal_limit", 409],
    ["manager.trade_closed", 409],
    ["manager.cash_invalid", 422],
    ["manager.trade_invalid", 422],
    ["manager.trade_unknown", 404],
  ])("maps %s of an exchange to %i", async (message, status) => {
    const rpc = vi.fn(async () => ({ data: null, error: { message } }));
    await expect(acceptTrade(client({}, rpc), "u1", "t1")).rejects.toMatchObject({
      status,
      code: message,
    });
  });

  it("sweeps the offers out of time and does not fail the round when it cannot", async () => {
    expect(
      await expireTrades(
        client(
          {},
          vi.fn(async () => ({ data: 3, error: null })),
        ),
      ),
    ).toBe(3);
    expect(
      await expireTrades(
        client(
          {},
          vi.fn(async () => ({ data: null, error: { message: "x" } })),
        ),
      ),
    ).toBe(0);
  });
});
