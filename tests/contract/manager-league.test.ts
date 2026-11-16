// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import {
  leagueViewSchema,
  lineupSchema,
  matchDetailSchema,
  matchListSchema,
} from "@/server/api/v1/schemas/manager";
import { apiRequest, expectProblem } from "./helpers";

const createClient = vi.fn();
const getLeagueView = vi.fn();
const listMyMatches = vi.fn();
const getMatch = vi.fn();
const getLineup = vi.fn();
const saveLineup = vi.fn();
const saveTraining = vi.fn();
const runRounds = vi.fn();
const requestFriendly = vi.fn();
const getFinance = vi.fn();
const getMarket = vi.fn();
const buyFreeAgent = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: { CRON_SECRET: "x".repeat(32), SUPABASE_SECRET_KEY: "secret" },
}));
vi.mock("@/server/services/manager/league", () => ({
  getLeagueView,
  listMyMatches,
  getMatch,
  getLineup,
  saveLineup,
  saveTraining,
}));
vi.mock("@/server/services/manager/season", () => ({ runRounds, requestFriendly }));
vi.mock("@/server/services/manager/market", () => ({ getFinance, getMarket, buyFreeAgent }));

const league = await import("@/app/api/v1/manager/league/route");
const matches = await import("@/app/api/v1/manager/matches/route");
const match = await import("@/app/api/v1/manager/match/route");
const lineup = await import("@/app/api/v1/manager/lineup/route");
const training = await import("@/app/api/v1/manager/training/route");
const friendly = await import("@/app/api/v1/manager/friendly/route");
const finance = await import("@/app/api/v1/manager/finance/route");
const market = await import("@/app/api/v1/manager/market/route");
const buy = await import("@/app/api/v1/manager/market/buy/route");
const cron = await import("@/app/api/cron/manager/route");

const USER = "99999999-9999-4999-8999-999999999999";
const CLUB = "11111111-1111-4111-8111-111111111111";
const MATCH = "33333333-3333-4333-8333-333333333333";
const PLAYERS = Array.from(
  { length: 11 },
  (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
);

const side = {
  clubId: CLUB,
  name: "Сокол Минск",
  primaryColor: "#d32f2f",
  secondaryColor: "#f5f5f5",
  logoUrl: null,
};
const summary = {
  id: MATCH,
  round: 1,
  kickoffAt: "2026-11-18T07:00:00.000Z",
  status: "scheduled" as const,
  kind: "league" as const,
  home: side,
  away: { ...side, clubId: "44444444-4444-4444-8444-444444444444", name: "Гранит Брест" },
  homeGoals: null,
  awayGoals: null,
};

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

const put = (body: unknown) =>
  apiRequest("/api/v1/manager/lineup", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const goodLineup = { formation: "4-4-2", mentality: "balanced", playerIds: PLAYERS };

beforeEach(() => {
  signedIn("user");
  getLeagueView.mockReset().mockResolvedValue({ league: null, table: [] });
  listMyMatches.mockReset().mockResolvedValue({ matches: [summary] });
  getMatch
    .mockReset()
    .mockResolvedValue({ ...summary, events: [], homeLineup: null, awayLineup: null });
  getLineup.mockReset().mockResolvedValue({
    formation: "4-4-2",
    mentality: "balanced",
    playerIds: PLAYERS,
    saved: false,
    locked: false,
    lockAt: "2026-11-18T06:55:00.000Z",
    nextKickoffAt: "2026-11-18T07:00:00.000Z",
  });
  saveLineup.mockReset().mockResolvedValue(undefined);
  saveTraining.mockReset().mockResolvedValue(undefined);
  runRounds.mockReset().mockResolvedValue({ played: 3, closed: 0, days: 0, opened: 0, pools: 0 });
  requestFriendly.mockReset().mockResolvedValue({ matchId: MATCH });
  getFinance
    .mockReset()
    .mockResolvedValue({ budget: 10000, squadNominal: 20000, wagePerRound: 100, transactions: [] });
  getMarket.mockReset().mockResolvedValue({
    open: false,
    matchesPlayed: 3,
    matchesNeeded: 10,
    budget: 10000,
    squadSize: 20,
    squadMax: 23,
    players: [],
  });
  buyFreeAgent.mockReset().mockResolvedValue({ budget: 9000 });
});

describe("league, matches and lineup are for signed-in users", () => {
  it("answers a guest with 401", async () => {
    signedIn("guest");
    await expectProblem(
      await league.GET(apiRequest("/api/v1/manager/league")),
      401,
      "auth.required",
    );
    await expectProblem(
      await matches.GET(apiRequest("/api/v1/manager/matches")),
      401,
      "auth.required",
    );
    await expectProblem(
      await match.GET(apiRequest(`/api/v1/manager/match?id=${MATCH}`)),
      401,
      "auth.required",
    );
    await expectProblem(
      await lineup.GET(apiRequest("/api/v1/manager/lineup")),
      401,
      "auth.required",
    );
    await expectProblem(await lineup.PUT(put(goodLineup)), 401, "auth.required");
    expect(saveLineup).not.toHaveBeenCalled();
  });
});

describe("the data endpoints", () => {
  it("returns the league, my matches, one match and my lineup in the documented shapes", async () => {
    const table = await (await league.GET(apiRequest("/api/v1/manager/league"))).json();
    expect(leagueViewSchema.parse(table.data)).toEqual({ league: null, table: [] });

    const list = await (await matches.GET(apiRequest("/api/v1/manager/matches"))).json();
    expect(matchListSchema.parse(list.data).matches).toHaveLength(1);

    const one = await (await match.GET(apiRequest(`/api/v1/manager/match?id=${MATCH}`))).json();
    expect(matchDetailSchema.parse(one.data).events).toEqual([]);

    const mine = await (await lineup.GET(apiRequest("/api/v1/manager/lineup"))).json();
    expect(lineupSchema.parse(mine.data).saved).toBe(false);
  });

  it("asks for a match id and answers 404 for a match of another league", async () => {
    await expectProblem(
      await match.GET(apiRequest("/api/v1/manager/match?id=nope")),
      422,
      "api.validation_failed",
    );
    getMatch.mockRejectedValueOnce(
      new ApiError(404, ERROR_CODES.notFound, "Not Found", "Match not found."),
    );
    await expectProblem(
      await match.GET(apiRequest(`/api/v1/manager/match?id=${MATCH}`)),
      404,
      "api.not_found",
    );
  });
});

describe("PUT /api/v1/manager/lineup", () => {
  it("saves a lineup of 11", async () => {
    const response = await lineup.PUT(put(goodLineup));
    expect(response.status).toBe(200);
    expect(saveLineup).toHaveBeenCalledWith({}, USER, goodLineup);
  });

  it.each([
    ["ten players", { ...goodLineup, playerIds: PLAYERS.slice(0, 10) }],
    ["an unknown formation", { ...goodLineup, formation: "9-0-1" }],
    ["an unknown tactic", { ...goodLineup, mentality: "reckless" }],
    ["a player id that is not an id", { ...goodLineup, playerIds: [...PLAYERS.slice(0, 10), "x"] }],
  ])("refuses %s with 422", async (_title, body) => {
    await expectProblem(await lineup.PUT(put(body)), 422, "api.validation_failed");
    expect(saveLineup).not.toHaveBeenCalled();
  });

  it("answers 409 once the round has started", async () => {
    saveLineup.mockRejectedValueOnce(
      new ApiError(409, ERROR_CODES.managerLineupLocked, "Conflict", "The round has started."),
    );
    await expectProblem(await lineup.PUT(put(goodLineup)), 409, "manager.lineup_locked");
  });
});

describe("POST /api/cron/manager", () => {
  const call = (token?: string) =>
    cron.POST(
      apiRequest("/api/cron/manager", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    );

  it("plays the due rounds for the scheduler and says how many matches it wrote", async () => {
    const response = await call("x".repeat(32));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      played: 3,
      closed: 0,
      days: 0,
      opened: 0,
      pools: 0,
    });
  });

  it("refuses a call without the secret or with a wrong one", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("y".repeat(32))).status).toBe(401);
    expect(runRounds).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v1/manager/training", () => {
  const putTraining = (body: unknown) =>
    apiRequest("/api/v1/manager/training", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const plans = {
    plans: [
      { playerId: PLAYERS[0], focus: "passing" },
      { playerId: PLAYERS[1], focus: null },
    ],
  };

  it("is for signed-in users", async () => {
    signedIn("guest");
    await expectProblem(await training.PUT(putTraining(plans)), 401, "auth.required");
    expect(saveTraining).not.toHaveBeenCalled();
  });

  it("saves the plans", async () => {
    const response = await training.PUT(putTraining(plans));
    expect(response.status).toBe(200);
    expect(saveTraining).toHaveBeenCalledWith({}, USER, plans);
  });

  it.each([
    ["no plans", { plans: [] }],
    ["a player that is not an id", { plans: [{ playerId: "x", focus: null }] }],
    [
      "more than 30 plans",
      { plans: Array.from({ length: 31 }, () => ({ playerId: PLAYERS[0], focus: null })) },
    ],
  ])("refuses %s with 422", async (_title, body) => {
    await expectProblem(await training.PUT(putTraining(body)), 422, "api.validation_failed");
    expect(saveTraining).not.toHaveBeenCalled();
  });

  it("answers 409 once the round has started", async () => {
    saveTraining.mockRejectedValueOnce(
      new ApiError(409, ERROR_CODES.managerTrainingLocked, "Conflict", "The round has started."),
    );
    await expectProblem(await training.PUT(putTraining(plans)), 409, "manager.training_locked");
  });
});

describe("POST /api/v1/manager/friendly", () => {
  const ask = () => friendly.POST(apiRequest("/api/v1/manager/friendly", { method: "POST" }));

  it("is for signed-in users", async () => {
    signedIn("guest");
    await expectProblem(await ask(), 401, "auth.required");
    expect(requestFriendly).not.toHaveBeenCalled();
  });

  it("sets up a friendly for the caller", async () => {
    const response = await ask();
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ matchId: MATCH });
    expect(requestFriendly).toHaveBeenCalledWith({}, USER);
  });

  it("answers 409 outside the preseason or when nobody is free", async () => {
    requestFriendly.mockRejectedValueOnce(
      new ApiError(409, ERROR_CODES.managerFriendlyUnavailable, "Conflict", "Preseason only."),
    );
    await expectProblem(await ask(), 409, "manager.friendly_unavailable");
    requestFriendly.mockRejectedValueOnce(
      new ApiError(409, ERROR_CODES.managerFriendlyBusy, "Conflict", "Nobody is free."),
    );
    await expectProblem(await ask(), 409, "manager.friendly_busy");
  });
});

describe("finance and market", () => {
  const post = (body: unknown) =>
    apiRequest("/api/v1/manager/market/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("are for signed-in users", async () => {
    signedIn("guest");
    await expectProblem(
      await finance.GET(apiRequest("/api/v1/manager/finance")),
      401,
      "auth.required",
    );
    await expectProblem(
      await market.GET(apiRequest("/api/v1/manager/market")),
      401,
      "auth.required",
    );
    await expectProblem(await buy.POST(post({ playerId: PLAYERS[0] })), 401, "auth.required");
    expect(buyFreeAgent).not.toHaveBeenCalled();
  });

  it("return the money and the market in the documented shapes", async () => {
    const money = await (await finance.GET(apiRequest("/api/v1/manager/finance"))).json();
    expect(money.data).toMatchObject({ budget: 10000, wagePerRound: 100 });
    const pool = await (await market.GET(apiRequest("/api/v1/manager/market"))).json();
    expect(pool.data).toMatchObject({ open: false, matchesNeeded: 10, squadMax: 23 });
  });

  it("buys a player for the caller", async () => {
    const response = await buy.POST(post({ playerId: PLAYERS[0] }));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ budget: 9000 });
    expect(buyFreeAgent).toHaveBeenCalledWith({}, USER, PLAYERS[0]);
  });

  it("asks for a player id", async () => {
    await expectProblem(await buy.POST(post({ playerId: "x" })), 422, "api.validation_failed");
    expect(buyFreeAgent).not.toHaveBeenCalled();
  });

  it.each([
    ["manager.market_closed"],
    ["manager.player_unavailable"],
    ["manager.squad_full"],
    ["manager.no_money"],
  ])("answers 409 %s", async (code) => {
    buyFreeAgent.mockRejectedValueOnce(new ApiError(409, code, "Conflict", "no"));
    await expectProblem(await buy.POST(post({ playerId: PLAYERS[0] })), 409, code);
  });
});
