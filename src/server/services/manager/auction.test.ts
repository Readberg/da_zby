import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import {
  SETTLE_BATCH,
  cancelLot,
  getAuctions,
  listPlayer,
  listPoolLots,
  placeBid,
  settleDueAuctions,
} from "./auction";
import { marketError } from "./market-errors";

/** A query that answers with `data` (and `count`) whatever is chained on it. */
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

const CLUB = { id: "club-1", name: "Сокол", league_id: "league-1", budget: 9500 };

function client(tables: Record<string, unknown>, rpc = vi.fn()) {
  return { from: (table: string) => tables[table] ?? chain([]), rpc } as never;
}

const lot = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  league_id: "league-1",
  player_id: "p1",
  seller_club_id: "club-2",
  start_price: 1000,
  step_percent: 20,
  nominal: 1000,
  status: "open",
  created_at: "2026-11-24T08:00:00Z",
  ends_at: "2026-11-25T07:00:00Z",
  bid_count: 0,
  best_bid: null,
  best_club_id: null,
  buyer_club_id: null,
  final_price: null,
  closed_at: null,
  ...over,
});

const player = {
  id: "p1",
  first_name: "Иван",
  last_name: "Новик",
  position: "MID",
  age: 24,
  ovr: 60,
};

describe("getAuctions", () => {
  it("lists the open lots with the least next bid, my lead and my own lots", async () => {
    const auctions = await getAuctions(
      client({
        mgr_clubs: chain([{ id: "club-2", name: "Торпедо" }], undefined, CLUB),
        mgr_matches: chain(null, 12),
        mgr_players: chain([player], 20),
        mgr_auctions: chain([
          lot(),
          lot({
            id: "a2",
            player_id: "p1",
            seller_club_id: "club-1",
            bid_count: 2,
            best_bid: 1200,
            best_club_id: "club-3",
          }),
          lot({ id: "a3", bid_count: 1, best_bid: 1000, best_club_id: "club-1" }),
        ]),
        mgr_bids: chain([{ auction_id: "a3", amount: 1000 }]),
      }),
      "u1",
    );
    expect(auctions.open).toBe(true);
    expect(auctions.squadSize).toBe(20);
    const [first, mine, leading] = auctions.lots;
    expect(first).toMatchObject({ mine: false, bestBid: null, minBid: 1000, leading: false });
    expect(mine).toMatchObject({ mine: true, bestBid: 1200, minBid: 1440 });
    expect(leading).toMatchObject({ leading: true, myBid: 1000, minBid: 1200 });
    expect(first?.endsAt).toBe("2026-11-25T07:00:00.000Z");
  });

  it("shows a lot of the pool without a seller", async () => {
    const auctions = await getAuctions(
      client({
        mgr_clubs: chain([], undefined, CLUB),
        mgr_matches: chain(null, 12),
        mgr_players: chain([player], 20),
        mgr_auctions: chain([lot({ seller_club_id: null })]),
        mgr_bids: chain([]),
      }),
      "u1",
    );
    expect(auctions.lots[0]).toMatchObject({
      pool: true,
      sellerClubId: null,
      sellerName: "",
      mine: false,
      minBid: 1000,
    });
  });

  it("is closed before 10 played matches and has no lots without a league", async () => {
    const early = await getAuctions(
      client({ mgr_clubs: chain(CLUB), mgr_matches: chain(null, 9), mgr_players: chain([], 20) }),
      "u1",
    );
    expect(early.open).toBe(false);
    const free = await getAuctions(
      client({
        mgr_clubs: chain({ ...CLUB, league_id: null }),
        mgr_matches: chain(null, 30),
        mgr_players: chain([], 20),
      }),
      "u1",
    );
    expect(free.lots).toEqual([]);
  });

  it("is 404 for a visitor without a club", async () => {
    await expect(getAuctions(client({ mgr_clubs: chain(null) }), "u1")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("the calls of the database", () => {
  it("puts a player up and says when the lot is settled", async () => {
    const rpc = vi.fn(async () => ({ data: "a1", error: null }));
    const db = client({ mgr_auctions: chain({ ends_at: "2026-11-25T07:00:00Z" }) }, rpc);
    expect(await listPlayer(db, "u1", { playerId: "p1", price: 900, stepPercent: 10 })).toEqual({
      auctionId: "a1",
      endsAt: "2026-11-25T07:00:00.000Z",
    });
    expect(rpc).toHaveBeenCalledWith("mgr_list_player", {
      p_user: "u1",
      p_player: "p1",
      p_price: 900,
      p_step: 10,
    });
  });

  it("places a bid and takes a lot off", async () => {
    const bid = vi.fn(async () => ({ data: "2026-11-25T07:00:00Z", error: null }));
    expect(await placeBid(client({}, bid), "u1", { auctionId: "a1", amount: 1200 })).toEqual({
      endsAt: "2026-11-25T07:00:00.000Z",
    });
    expect(bid).toHaveBeenCalledWith("mgr_place_bid", {
      p_user: "u1",
      p_auction: "a1",
      p_amount: 1200,
    });
    const cancel = vi.fn(async () => ({ data: true, error: null }));
    expect(await cancelLot(client({}, cancel), "u1", "a1")).toEqual({ cancelled: true });
  });

  it.each([
    ["manager.bid_too_low", 409, "manager.bid_too_low"],
    ["manager.own_auction", 409, "manager.own_auction"],
    ["manager.bid_leading", 409, "manager.bid_leading"],
    ["manager.auction_closed", 409, "manager.auction_closed"],
    ["manager.no_money", 409, "manager.no_money"],
    ["manager.deal_limit", 409, "manager.deal_limit"],
    ["manager.auction_unknown", 404, "manager.auction_unknown"],
    ["manager.club_unknown", 404, "api.not_found"],
  ])("maps the refusal %s of a bid to %i", async (message, status, code) => {
    const rpc = vi.fn(async () => ({ data: null, error: { message } }));
    const result = placeBid(client({}, rpc), "u1", { auctionId: "a1", amount: 1 });
    await expect(result).rejects.toMatchObject({ status, code });
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });

  it.each([
    ["manager.price_invalid", 422],
    ["manager.step_invalid", 422],
    ["manager.player_locked", 409],
    ["manager.contract_ending", 409],
    ["manager.squad_min", 409],
    ["manager.lots_limit", 409],
    ["manager.market_closed", 409],
  ])("maps the refusal %s of a listing to %i", async (message, status) => {
    const rpc = vi.fn(async () => ({ data: null, error: { message } }));
    await expect(
      listPlayer(client({}, rpc), "u1", { playerId: "p", price: 1, stepPercent: 10 }),
    ).rejects.toMatchObject({ status, code: message });
  });

  it("does not hide a failure it does not know", () => {
    expect(() => marketError({ message: "connection reset" })).toThrow("connection reset");
  });
});

describe("settleDueAuctions", () => {
  it("settles every due lot once and counts those it closed", async () => {
    const results: Record<string, string | null> = { a1: "sold", a2: null, a3: "unsold" };
    const rpc = vi.fn(async (name: string, args?: { p_auction: string }) =>
      name === "mgr_due_auctions"
        ? { data: ["a1", "a2", "a3"], error: null }
        : { data: results[args!.p_auction], error: null },
    );
    expect(await settleDueAuctions(client({}, rpc))).toBe(2);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "mgr_due_auctions",
      "mgr_settle_auction",
      "mgr_settle_auction",
      "mgr_settle_auction",
    ]);
  });

  it("settles a batch at most, the rest wait for the next call", async () => {
    const ids = Array.from({ length: SETTLE_BATCH + 5 }, (_, i) => `a${i}`);
    const rpc = vi.fn(async (name: string) =>
      name === "mgr_due_auctions" ? { data: ids, error: null } : { data: "unsold", error: null },
    );
    expect(await settleDueAuctions(client({}, rpc))).toBe(SETTLE_BATCH);
    expect(rpc).toHaveBeenCalledTimes(SETTLE_BATCH + 1);
  });

  it("goes on with the next lot when one fails", async () => {
    const rpc = vi.fn(async (name: string, args?: { p_auction: string }) => {
      if (name === "mgr_due_auctions") return { data: ["a1", "a2"], error: null };
      return args!.p_auction === "a1"
        ? { data: null, error: { message: "deadlock detected" } }
        : { data: "sold", error: null };
    });
    expect(await settleDueAuctions(client({}, rpc))).toBe(1);
  });
});

describe("listPoolLots", () => {
  it("asks the database to put the free players up and counts the new lots", async () => {
    const rpc = vi.fn(async () => ({ data: 3, error: null }));
    expect(await listPoolLots(client({}, rpc))).toBe(3);
    expect(rpc).toHaveBeenCalledWith("mgr_list_pool", {});
  });

  it("does not stop the scheduler when it fails", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    expect(await listPoolLots(client({}, rpc))).toBe(0);
  });
});
