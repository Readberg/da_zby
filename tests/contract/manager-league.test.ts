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
const playAllDue = vi.fn();

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
  playAllDue,
}));

const league = await import("@/app/api/v1/manager/league/route");
const matches = await import("@/app/api/v1/manager/matches/route");
const match = await import("@/app/api/v1/manager/match/route");
const lineup = await import("@/app/api/v1/manager/lineup/route");
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
};
const summary = {
  id: MATCH,
  round: 1,
  kickoffAt: "2026-11-18T07:00:00.000Z",
  status: "scheduled" as const,
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
    nextKickoffAt: "2026-11-18T07:00:00.000Z",
  });
  saveLineup.mockReset().mockResolvedValue(undefined);
  playAllDue.mockReset().mockResolvedValue(3);
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
    expect(await response.json()).toEqual({ ok: true, played: 3 });
  });

  it("refuses a call without the secret or with a wrong one", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("y".repeat(32))).status).toBe(401);
    expect(playAllDue).not.toHaveBeenCalled();
  });
});
