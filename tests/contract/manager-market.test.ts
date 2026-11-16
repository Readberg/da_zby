// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import {
  auctionsSchema,
  contractsSchema,
  tradesSchema,
} from "@/server/api/v1/schemas/manager-market";
import { apiRequest, expectProblem } from "./helpers";

const createClient = vi.fn();
const getAuctions = vi.fn();
const listPlayer = vi.fn();
const placeBid = vi.fn();
const cancelLot = vi.fn();
const getContracts = vi.fn();
const extendContract = vi.fn();
const terminateContract = vi.fn();
const getTrades = vi.fn();
const getClubSquad = vi.fn();
const proposeTrade = vi.fn();
const acceptTrade = vi.fn();
const closeTrade = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/server/services/manager/auction", () => ({
  getAuctions,
  listPlayer,
  placeBid,
  cancelLot,
}));
vi.mock("@/server/services/manager/contracts", () => ({
  getContracts,
  extendContract,
  terminateContract,
}));
vi.mock("@/server/services/manager/trade", () => ({
  getTrades,
  getClubSquad,
  proposeTrade,
  acceptTrade,
  closeTrade,
}));

const auctions = await import("@/app/api/v1/manager/auctions/route");
const bid = await import("@/app/api/v1/manager/auctions/bid/route");
const cancel = await import("@/app/api/v1/manager/auctions/cancel/route");
const contracts = await import("@/app/api/v1/manager/contracts/route");
const extend = await import("@/app/api/v1/manager/contracts/extend/route");
const terminate = await import("@/app/api/v1/manager/contracts/terminate/route");
const trades = await import("@/app/api/v1/manager/trades/route");
const club = await import("@/app/api/v1/manager/trades/club/route");
const accept = await import("@/app/api/v1/manager/trades/accept/route");
const decline = await import("@/app/api/v1/manager/trades/decline/route");
const withdraw = await import("@/app/api/v1/manager/trades/cancel/route");

const USER = "99999999-9999-4999-8999-999999999999";
const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

function signedIn(role: "guest" | "user") {
  createClient.mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: role === "guest" ? null : { id: USER } },
        error: null,
      })),
    },
  });
}

const post = (path: string, body: unknown) =>
  apiRequest(`/api/v1/manager/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const player = {
  id: ID,
  firstName: "Иван",
  lastName: "Новик",
  position: "MID" as const,
  age: 24,
  overall: 60,
};

beforeEach(() => {
  signedIn("user");
  getAuctions.mockReset().mockResolvedValue({
    open: true,
    budget: 9000,
    squadSize: 20,
    squadMax: 23,
    maxOpenLots: 5,
    lots: [
      {
        id: ID,
        player,
        sellerClubId: ID2,
        sellerName: "Торпедо",
        mine: false,
        nominal: 1000,
        startPrice: 1000,
        stepPercent: 20,
        bidCount: 0,
        bestBid: null,
        minBid: 1000,
        leading: false,
        myBid: null,
        endsAt: "2026-11-26T07:00:00.000Z",
      },
    ],
  });
  listPlayer.mockReset().mockResolvedValue({ auctionId: ID, endsAt: "2026-11-26T07:00:00.000Z" });
  placeBid.mockReset().mockResolvedValue({ endsAt: "2026-11-26T07:00:00.000Z" });
  cancelLot.mockReset().mockResolvedValue({ cancelled: true });
  getContracts.mockReset().mockResolvedValue({
    season: 2,
    budget: 9000,
    squadSize: 20,
    squadMin: 17,
    players: [
      {
        ...player,
        nominal: 1000,
        wage: 5,
        contractUntil: 3,
        roundsLeft: 60,
        tradableAfter: null,
        onAuction: false,
        retiring: false,
        canSell: true,
        sellBlock: null,
        canExtend: true,
        breakPenalty: 200,
        priceMin: 500,
        priceMax: 2000,
      },
    ],
  });
  extendContract.mockReset().mockResolvedValue({ result: "accepted" });
  terminateContract.mockReset().mockResolvedValue({ penalty: 200 });
  getTrades.mockReset().mockResolvedValue({
    open: true,
    budget: 9000,
    squad: [],
    clubs: [{ id: ID2, name: "Торпедо" }],
    trades: [],
  });
  getClubSquad.mockReset().mockResolvedValue({ club: { id: ID2, name: "Торпедо" }, players: [] });
  proposeTrade.mockReset().mockResolvedValue({ tradeId: ID });
  acceptTrade.mockReset().mockResolvedValue({ done: true });
  closeTrade.mockReset().mockResolvedValue({ done: true });
});

describe("the market is for signed-in users", () => {
  it("answers a guest with 401 everywhere", async () => {
    signedIn("guest");
    const responses = [
      await auctions.GET(apiRequest("/api/v1/manager/auctions")),
      await contracts.GET(apiRequest("/api/v1/manager/contracts")),
      await trades.GET(apiRequest("/api/v1/manager/trades")),
      await bid.POST(post("auctions/bid", { auctionId: ID, amount: 5 })),
      await accept.POST(post("trades/accept", { tradeId: ID })),
    ];
    for (const response of responses) await expectProblem(response, 401, "auth.required");
    expect(placeBid).not.toHaveBeenCalled();
    expect(acceptTrade).not.toHaveBeenCalled();
  });
});

describe("auction", () => {
  it("lists the lots in the documented shape", async () => {
    const body = await (await auctions.GET(apiRequest("/api/v1/manager/auctions"))).json();
    expect(auctionsSchema.safeParse(body.data).success).toBe(true);
  });

  it("puts a player up with a price and a step of 10, 20 or 30", async () => {
    const ok = await auctions.POST(post("auctions", { playerId: ID, price: 900, stepPercent: 20 }));
    expect(ok.status).toBe(200);
    expect(listPlayer).toHaveBeenCalledWith({}, USER, {
      playerId: ID,
      price: 900,
      stepPercent: 20,
    });
    await expectProblem(
      await auctions.POST(post("auctions", { playerId: ID, price: 900, stepPercent: 15 })),
      422,
      "api.validation_failed",
    );
    await expectProblem(
      await auctions.POST(post("auctions", { playerId: ID, price: 0, stepPercent: 10 })),
      422,
      "api.validation_failed",
    );
  });

  it("bids and takes a lot off for the caller", async () => {
    expect((await bid.POST(post("auctions/bid", { auctionId: ID, amount: 1200 }))).status).toBe(
      200,
    );
    expect(placeBid).toHaveBeenCalledWith({}, USER, { auctionId: ID, amount: 1200 });
    expect((await cancel.POST(post("auctions/cancel", { auctionId: ID }))).status).toBe(200);
    expect(cancelLot).toHaveBeenCalledWith({}, USER, ID);
  });

  it.each([
    ["manager.bid_too_low", 409],
    ["manager.has_bids", 409],
    ["manager.price_invalid", 422],
    ["manager.auction_unknown", 404],
  ])("answers %s with %i", async (code, status) => {
    placeBid.mockRejectedValueOnce(new ApiError(status, code, "Problem", "no"));
    await expectProblem(
      await bid.POST(post("auctions/bid", { auctionId: ID, amount: 1 })),
      status,
      code,
    );
  });
});

describe("contracts", () => {
  it("lists the squad with the contracts in the documented shape", async () => {
    const body = await (await contracts.GET(apiRequest("/api/v1/manager/contracts"))).json();
    expect(contractsSchema.safeParse(body.data).success).toBe(true);
  });

  it("offers a term of 1 to 3 seasons and breaks a contract", async () => {
    expect((await extend.POST(post("contracts/extend", { playerId: ID, seasons: 2 }))).status).toBe(
      200,
    );
    expect(extendContract).toHaveBeenCalledWith({}, USER, { playerId: ID, seasons: 2 });
    await expectProblem(
      await extend.POST(post("contracts/extend", { playerId: ID, seasons: 4 })),
      422,
      "api.validation_failed",
    );
    const done = await terminate.POST(post("contracts/terminate", { playerId: ID }));
    expect((await done.json()).data).toEqual({ penalty: 200 });
  });

  it("answers 409 when an offer was made already", async () => {
    extendContract.mockRejectedValueOnce(new ApiError(409, "manager.offer_used", "Conflict", "no"));
    await expectProblem(
      await extend.POST(post("contracts/extend", { playerId: ID, seasons: 1 })),
      409,
      "manager.offer_used",
    );
  });
});

describe("exchange", () => {
  it("lists offers in the documented shape and the squad of another club", async () => {
    const body = await (await trades.GET(apiRequest("/api/v1/manager/trades"))).json();
    expect(tradesSchema.safeParse(body.data).success).toBe(true);
    const squad = await club.GET(apiRequest(`/api/v1/manager/trades/club?clubId=${ID2}`));
    expect(squad.status).toBe(200);
    expect(getClubSquad).toHaveBeenCalledWith({}, USER, ID2);
    await expectProblem(
      await club.GET(apiRequest("/api/v1/manager/trades/club?clubId=x")),
      422,
      "api.validation_failed",
    );
  });

  it("offers 1 to 3 players for 1 to 3, with money on top", async () => {
    const body = { toClubId: ID2, give: [ID], take: [ID2], cash: -300 };
    expect((await trades.POST(post("trades", body))).status).toBe(200);
    expect(proposeTrade).toHaveBeenCalledWith({}, USER, body);
    for (const bad of [
      { ...body, give: [] },
      { ...body, take: [ID, ID, ID, ID] },
      { ...body, cash: 1.5 },
    ]) {
      await expectProblem(await trades.POST(post("trades", bad)), 422, "api.validation_failed");
    }
  });

  it("accepts, declines and withdraws for the caller", async () => {
    await accept.POST(post("trades/accept", { tradeId: ID }));
    expect(acceptTrade).toHaveBeenCalledWith({}, USER, ID);
    await decline.POST(post("trades/decline", { tradeId: ID }));
    expect(closeTrade).toHaveBeenLastCalledWith({}, USER, ID, "decline");
    await withdraw.POST(post("trades/cancel", { tradeId: ID }));
    expect(closeTrade).toHaveBeenLastCalledWith({}, USER, ID, "cancel");
  });

  it("answers 409 for an offer that is closed", async () => {
    acceptTrade.mockRejectedValueOnce(new ApiError(409, "manager.trade_closed", "Conflict", "no"));
    await expectProblem(
      await accept.POST(post("trades/accept", { tradeId: ID })),
      409,
      "manager.trade_closed",
    );
  });
});
