// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deletedSchema,
  matchSchema,
  recalculatedSchema,
  seasonClubsResultSchema,
  seasonDetailSchema,
  seasonListSchema,
  seasonStateSchema,
  seasonSummarySchema,
  tourDetailSchema,
  tourSummarySchema,
} from "@/server/api/v1/schemas/admin-season";
import { ApiError } from "@/server/api/v1/problem";
import { apiRequest, expectProblem } from "./helpers";

import { invalidateRating } from "@/server/cache";

const createClient = vi.fn();
const seasons = {
  listSeasons: vi.fn(),
  createSeason: vi.fn(),
  getSeason: vi.fn(),
  setSeasonClubs: vi.fn(),
  closeSeason: vi.fn(),
  reopenSeason: vi.fn(),
  recalculateSeason: vi.fn(),
};
const matches = {
  getTour: vi.fn(),
  createTour: vi.fn(),
  updateTour: vi.fn(),
  deleteTour: vi.fn(),
  createMatch: vi.fn(),
  updateMatch: vi.fn(),
  deleteMatch: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/server/services/admin-seasons", () => seasons);
vi.mock("@/server/services/admin-matches", () => matches);

const seasonsRoute = await import("@/app/api/v1/admin/seasons/route");
const seasonRoute = await import("@/app/api/v1/admin/season/route");
const clubsRoute = await import("@/app/api/v1/admin/seasons/clubs/route");
const closeRoute = await import("@/app/api/v1/admin/seasons/close/route");
const reopenRoute = await import("@/app/api/v1/admin/seasons/reopen/route");
const recalcRoute = await import("@/app/api/v1/admin/seasons/recalculate/route");
const toursRoute = await import("@/app/api/v1/admin/tours/route");
const tourRoute = await import("@/app/api/v1/admin/tour/route");
const matchesRoute = await import("@/app/api/v1/admin/matches/route");

const S = "11111111-1111-4111-8111-111111111111";
const T = "44444444-4444-4444-8444-444444444444";
const M = "55555555-5555-4555-8555-555555555555";
const A = "33333333-3333-4333-8333-333333333331";
const B = "33333333-3333-4333-8333-333333333332";

const season = {
  id: S,
  tournamentId: "t",
  tournamentName: "Высшая лига",
  name: "2026",
  status: "active" as const,
  closedAt: null,
  clubsCount: 2,
  toursCount: 1,
};
const tour = {
  id: T,
  seasonId: S,
  number: 1,
  title: null,
  deadlineOverride: null,
  deadlineAt: null,
  matchesCount: 0,
};
const match = {
  id: M,
  tourId: T,
  homeClubId: A,
  awayClubId: B,
  homeName: "Динамо",
  awayName: "БАТЭ",
  kickoffAt: "2026-10-30T15:00:00.000Z",
  status: "scheduled" as const,
  homeScore: null,
  awayScore: null,
};

function client(who: "guest" | "user" | "admin") {
  createClient.mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: who === "guest" ? null : { id: "u1" } },
        error: null,
      })),
    },
    rpc: vi.fn(async () => ({ data: who === "admin", error: null })),
  });
}

const call = (path: string, method: string, body?: unknown) =>
  apiRequest(`/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

beforeEach(() => {
  for (const fn of [...Object.values(seasons), ...Object.values(matches)]) fn.mockReset();
  seasons.listSeasons.mockResolvedValue({ items: [season] });
  seasons.createSeason.mockResolvedValue(season);
  seasons.getSeason.mockResolvedValue({ season, clubIds: [A, B], tours: [tour] });
  seasons.setSeasonClubs.mockResolvedValue({ clubIds: [A, B] });
  seasons.closeSeason.mockResolvedValue({ seasonId: S, status: "closed" });
  seasons.reopenSeason.mockResolvedValue({ seasonId: S, status: "active" });
  seasons.recalculateSeason.mockResolvedValue({ seasonId: S });
  matches.getTour.mockResolvedValue({
    tour,
    season: { id: S, name: "2026", status: "active" },
    clubs: [{ id: A, name: "Динамо" }],
    matches: [match],
  });
  matches.createTour.mockResolvedValue(tour);
  matches.updateTour.mockResolvedValue(tour);
  matches.deleteTour.mockResolvedValue({ id: T });
  matches.createMatch.mockResolvedValue(match);
  matches.updateMatch.mockResolvedValue(match);
  matches.deleteMatch.mockResolvedValue({ id: M });
});

const operations: [string, () => Promise<Response>, (data: unknown) => unknown][] = [
  [
    "GET /admin/seasons",
    () => seasonsRoute.GET(call("/admin/seasons", "GET")),
    (d) => seasonListSchema.parse(d),
  ],
  [
    "POST /admin/seasons",
    () => seasonsRoute.POST(call("/admin/seasons", "POST", { tournamentId: S, name: "2026" })),
    (d) => seasonSummarySchema.parse(d),
  ],
  [
    "GET /admin/season",
    () => seasonRoute.GET(call(`/admin/season?seasonId=${S}`, "GET")),
    (d) => seasonDetailSchema.parse(d),
  ],
  [
    "PUT /admin/seasons/clubs",
    () => clubsRoute.PUT(call("/admin/seasons/clubs", "PUT", { seasonId: S, clubIds: [A, B] })),
    (d) => seasonClubsResultSchema.parse(d),
  ],
  [
    "POST /admin/seasons/close",
    () => closeRoute.POST(call("/admin/seasons/close", "POST", { seasonId: S })),
    (d) => seasonStateSchema.parse(d),
  ],
  [
    "POST /admin/seasons/reopen",
    () => reopenRoute.POST(call("/admin/seasons/reopen", "POST", { seasonId: S })),
    (d) => seasonStateSchema.parse(d),
  ],
  [
    "POST /admin/seasons/recalculate",
    () => recalcRoute.POST(call("/admin/seasons/recalculate", "POST", { seasonId: S })),
    (d) => recalculatedSchema.parse(d),
  ],
  [
    "POST /admin/tours",
    () => toursRoute.POST(call("/admin/tours", "POST", { seasonId: S })),
    (d) => tourSummarySchema.parse(d),
  ],
  [
    "PATCH /admin/tours",
    () => toursRoute.PATCH(call("/admin/tours", "PATCH", { id: T, title: "Финал" })),
    (d) => tourSummarySchema.parse(d),
  ],
  [
    "DELETE /admin/tours",
    () => toursRoute.DELETE(call("/admin/tours", "DELETE", { id: T })),
    (d) => deletedSchema.parse(d),
  ],
  [
    "GET /admin/tour",
    () => tourRoute.GET(call(`/admin/tour?tourId=${T}`, "GET")),
    (d) => tourDetailSchema.parse(d),
  ],
  [
    "POST /admin/matches",
    () =>
      matchesRoute.POST(
        call("/admin/matches", "POST", {
          tourId: T,
          homeClubId: A,
          awayClubId: B,
          kickoffAt: "2026-10-30T15:00:00Z",
        }),
      ),
    (d) => matchSchema.parse(d),
  ],
  [
    "PATCH /admin/matches",
    () =>
      matchesRoute.PATCH(
        call("/admin/matches", "PATCH", { id: M, status: "finished", homeScore: 2, awayScore: 1 }),
      ),
    (d) => matchSchema.parse(d),
  ],
  [
    "DELETE /admin/matches",
    () => matchesRoute.DELETE(call("/admin/matches", "DELETE", { id: M })),
    (d) => deletedSchema.parse(d),
  ],
];

describe("season, tour and match endpoints", () => {
  it.each(operations)("%s is closed to guests and ordinary users", async (_name, run) => {
    client("guest");
    await expectProblem(await run(), 401, "auth.required");
    client("user");
    await expectProblem(await run(), 403, "auth.forbidden");
    for (const fn of [...Object.values(seasons), ...Object.values(matches)]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it.each(operations)(
    "%s answers an admin with the published contract",
    async (_name, run, parse) => {
      client("admin");
      const response = await run();
      expect(response.status).toBe(200);
      expect(parse((await response.json()).data)).toBeTruthy();
    },
  );
});

describe("request handling", () => {
  it("passes a result to the service as entered", async () => {
    client("admin");
    await operations[12]![1]();
    expect(matches.updateMatch).toHaveBeenCalledWith(expect.anything(), {
      id: M,
      status: "finished",
      homeScore: 2,
      awayScore: 1,
    });
  });

  it("rejects the same club on both sides with a field error", async () => {
    client("admin");
    const response = await matchesRoute.POST(
      call("/admin/matches", "POST", {
        tourId: T,
        homeClubId: A,
        awayClubId: A,
        kickoffAt: "2026-10-30T15:00:00Z",
      }),
    );
    const problem = await expectProblem(response, 422, "api.validation_failed");
    expect(problem.errors?.[0]?.field).toBe("awayClubId");
    expect(matches.createMatch).not.toHaveBeenCalled();
  });

  it("rejects a malformed id and an out-of-range score", async () => {
    client("admin");
    await expectProblem(
      await seasonRoute.GET(call("/admin/season?seasonId=nope", "GET")),
      422,
      "api.validation_failed",
    );
    await expectProblem(
      await matchesRoute.PATCH(call("/admin/matches", "PATCH", { id: M, homeScore: 100 })),
      422,
      "api.validation_failed",
    );
  });

  it.each([
    [
      "admin.season_closed",
      () => matchesRoute.PATCH(call("/admin/matches", "PATCH", { id: M, status: "cancelled" })),
    ],
    [
      "admin.season_state",
      () => closeRoute.POST(call("/admin/seasons/close", "POST", { seasonId: S })),
    ],
    ["admin.in_use", () => toursRoute.DELETE(call("/admin/tours", "DELETE", { id: T }))],
  ])("reports %s as 409", async (code, run) => {
    client("admin");
    const error = new ApiError(409, code, "Conflict", "x");
    for (const fn of [matches.updateMatch, seasons.closeSeason, matches.deleteTour]) {
      fn.mockRejectedValue(error);
    }
    await expectProblem(await run(), 409, code);
  });
});

describe("rating cache", () => {
  it("is cleared after a result is entered, a season closed or a tour created", async () => {
    client("admin");
    vi.mocked(invalidateRating).mockClear();
    for (const index of [12, 4, 7]) await operations[index]![1]();
    expect(invalidateRating).toHaveBeenCalledTimes(3);
  });

  it("is left alone for reads and for rejected requests", async () => {
    vi.mocked(invalidateRating).mockClear();
    client("admin");
    await operations[0]![1]();
    await operations[10]![1]();
    client("user");
    await operations[12]![1]();
    client("admin");
    matches.updateMatch.mockRejectedValue(
      new ApiError(409, "admin.season_closed", "Conflict", "x"),
    );
    await operations[12]![1]();
    expect(invalidateRating).not.toHaveBeenCalled();
  });
});
