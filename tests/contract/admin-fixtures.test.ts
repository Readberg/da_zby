// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateRating } from "@/server/cache";
import { ApiError } from "@/server/api/v1/problem";
import {
  fixturesAppliedSchema,
  fixturesPreviewSchema,
} from "@/server/api/v1/schemas/admin-fixtures";
import { apiRequest, expectProblem } from "./helpers";

const createClient = vi.fn();
const fixtures = { previewFixtures: vi.fn(), applyFixtures: vi.fn() };

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/env.server", () => ({ serverEnv: { THESPORTSDB_API_KEY: "own-key" } }));
vi.mock("@/server/services/admin-fixtures", () => fixtures);

const route = await import("@/app/api/v1/admin/fixtures/route");

const TOUR = "44444444-4444-4444-8444-444444444444";

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

const preview = {
  source: "TheSportsDB",
  season: "2026",
  round: 3,
  rows: [
    {
      key: "Dinamo Minsk|BATE Borisov",
      fixture: {
        home: "Dinamo Minsk",
        away: "BATE Borisov",
        kickoffAt: "2026-10-30T15:00:00.000Z",
        status: "scheduled",
        homeScore: null,
        awayScore: null,
      },
      homeName: "Динамо Минск",
      awayName: "БАТЭ",
      action: "create",
      current: null,
      next: {
        kickoffAt: "2026-10-30T15:00:00.000Z",
        status: "scheduled",
        homeScore: null,
        awayScore: null,
      },
      matchId: null,
      notes: [],
    },
  ],
  extra: [],
};

const get = (query: string) => apiRequest(`/api/v1/admin/fixtures${query}`);
const post = (body: unknown) =>
  apiRequest("/api/v1/admin/fixtures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  fixtures.previewFixtures.mockReset().mockResolvedValue(preview);
  fixtures.applyFixtures.mockReset().mockResolvedValue({ created: 1, updated: 0, skipped: [] });
  vi.mocked(invalidateRating).mockClear();
});

describe("GET /api/v1/admin/fixtures", () => {
  it("is closed to guests (401) and to ordinary users (403)", async () => {
    client("guest");
    await expectProblem(await route.GET(get(`?tourId=${TOUR}`)), 401, "auth.required");
    client("user");
    await expectProblem(await route.GET(get(`?tourId=${TOUR}`)), 403, "auth.forbidden");
    expect(fixtures.previewFixtures).not.toHaveBeenCalled();
  });

  it("returns the preview to an admin and passes the round and the key on", async () => {
    client("admin");
    const response = await route.GET(get(`?tourId=${TOUR}&round=5`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    fixturesPreviewSchema.parse((await response.json()).data);
    expect(fixtures.previewFixtures).toHaveBeenCalledWith(
      expect.anything(),
      { tourId: TOUR, round: 5 },
      expect.objectContaining({ apiKey: "own-key" }),
    );
  });

  it("rejects a bad tour id or round", async () => {
    client("admin");
    await expectProblem(await route.GET(get("?tourId=x")), 422, "api.validation_failed");
    await expectProblem(
      await route.GET(get(`?tourId=${TOUR}&round=0`)),
      422,
      "api.validation_failed",
    );
  });

  it("passes the 502 of an unavailable source through", async () => {
    client("admin");
    fixtures.previewFixtures.mockRejectedValue(
      new ApiError(502, "fixtures.unavailable", "Bad Gateway", "TheSportsDB: down"),
    );
    await expectProblem(await route.GET(get(`?tourId=${TOUR}`)), 502, "fixtures.unavailable");
  });
});

describe("POST /api/v1/admin/fixtures", () => {
  it("is closed to guests and ordinary users and changes nothing for them", async () => {
    client("guest");
    await expectProblem(
      await route.POST(post({ tourId: TOUR, keys: ["a|b"] })),
      401,
      "auth.required",
    );
    client("user");
    await expectProblem(
      await route.POST(post({ tourId: TOUR, keys: ["a|b"] })),
      403,
      "auth.forbidden",
    );
    expect(fixtures.applyFixtures).not.toHaveBeenCalled();
    expect(invalidateRating).not.toHaveBeenCalled();
  });

  it("applies the confirmed rows and clears the rating cache", async () => {
    client("admin");
    const response = await route.POST(post({ tourId: TOUR, keys: ["Dinamo Minsk|BATE Borisov"] }));
    expect(response.status).toBe(200);
    fixturesAppliedSchema.parse((await response.json()).data);
    expect(fixtures.applyFixtures).toHaveBeenCalledWith(
      expect.anything(),
      { tourId: TOUR, keys: ["Dinamo Minsk|BATE Borisov"] },
      expect.objectContaining({ apiKey: "own-key" }),
    );
    expect(invalidateRating).toHaveBeenCalledOnce();
  });

  it("needs at least one key", async () => {
    client("admin");
    await expectProblem(
      await route.POST(post({ tourId: TOUR, keys: [] })),
      422,
      "api.validation_failed",
    );
    await expectProblem(await route.POST(post({ tourId: TOUR })), 422, "api.validation_failed");
  });
});
