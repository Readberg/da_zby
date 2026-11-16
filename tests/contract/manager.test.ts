// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import { managerClubViewSchema, managerClubSchema } from "@/server/api/v1/schemas/manager";
import { resetRateLimits } from "@/lib/rate-limit";
import { apiRequest, expectApiHeaders, expectProblem } from "./helpers";

const createClient = vi.fn();
const listCities = vi.fn();
const getMyClub = vi.fn();
const getMyPlayer = vi.fn();
const createClub = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/server/services/manager/club", () => ({
  listCities,
  getMyClub,
  getMyPlayer,
  createClub,
}));

const cities = await import("@/app/api/v1/manager/cities/route");
const club = await import("@/app/api/v1/manager/club/route");
const player = await import("@/app/api/v1/manager/player/route");

const USER = "99999999-9999-4999-8999-999999999999";
const CLUB = "11111111-1111-4111-8111-111111111111";
const PLAYER = "22222222-2222-4222-8222-222222222222";

const myClub = {
  id: CLUB,
  name: "Dinamo Test",
  country: "BY",
  city: { id: 1, name: "Минск" },
  primaryColor: "#d32f2f",
  secondaryColor: "#f5f5f5",
  createdAt: "2026-11-16T10:00:00.000Z",
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

const post = (body: unknown) =>
  apiRequest("/api/v1/manager/club", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const valid = {
  name: "Dinamo Test",
  cityId: 1,
  primaryColor: "#d32f2f",
  secondaryColor: "#f5f5f5",
};

beforeEach(() => {
  resetRateLimits();
  signedIn("user");
  listCities
    .mockReset()
    .mockResolvedValue({ cities: [{ id: 1, name: "Минск" }], colors: ["#d32f2f"] });
  getMyClub.mockReset().mockResolvedValue({
    club: null,
    players: [],
    leagueNumber: null,
    season: null,
    phase: null,
    preseasonEndsAt: null,
    nextMatch: null,
  });
  getMyPlayer.mockReset();
  createClub.mockReset().mockResolvedValue(myClub);
});

describe("the football manager API is for signed-in users", () => {
  it("answers a guest with 401 on every endpoint", async () => {
    signedIn("guest");
    await expectProblem(
      await cities.GET(apiRequest("/api/v1/manager/cities")),
      401,
      "auth.required",
    );
    await expectProblem(await club.GET(apiRequest("/api/v1/manager/club")), 401, "auth.required");
    await expectProblem(await club.POST(post(valid)), 401, "auth.required");
    await expectProblem(
      await player.GET(apiRequest(`/api/v1/manager/player?id=${PLAYER}`)),
      401,
      "auth.required",
    );
    expect(createClub).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/manager/club", () => {
  it("returns club null before a club is made", async () => {
    const response = await club.GET(apiRequest("/api/v1/manager/club"));
    expectApiHeaders(response);
    const { data } = await response.json();
    expect(managerClubViewSchema.parse(data)).toEqual({
      club: null,
      players: [],
      leagueNumber: null,
      season: null,
      phase: null,
      preseasonEndsAt: null,
      nextMatch: null,
    });
  });
});

describe("POST /api/v1/manager/club", () => {
  it("makes the club of the caller", async () => {
    const response = await club.POST(post(valid));
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(managerClubSchema.parse(data).name).toBe("Dinamo Test");
    expect(createClub).toHaveBeenCalledWith({}, expect.anything(), USER, valid);
  });

  it.each([
    ["an empty name", { ...valid, name: "  " }],
    ["a name of more than 30 characters", { ...valid, name: "A".repeat(31) }],
    ["punctuation in the name", { ...valid, name: "Dinamo!" }],
    ["two spaces in a row", { ...valid, name: "Dinamo  Test" }],
    ["a colour outside the palette", { ...valid, primaryColor: "#123456" }],
    ["the same colour twice", { ...valid, secondaryColor: "#d32f2f" }],
  ])("refuses %s with 422", async (_title, body) => {
    await expectProblem(await club.POST(post(body)), 422, "api.validation_failed");
    expect(createClub).not.toHaveBeenCalled();
  });

  it("accepts Cyrillic and digits", async () => {
    const response = await club.POST(post({ ...valid, name: "Динамо 1948" }));
    expect(response.status).toBe(200);
  });

  it("answers 409 for a second club and for a taken name", async () => {
    createClub.mockRejectedValueOnce(
      new ApiError(409, ERROR_CODES.managerClubExists, "Conflict", "You already have a club."),
    );
    await expectProblem(await club.POST(post(valid)), 409, "manager.club_exists");
    createClub.mockRejectedValueOnce(
      new ApiError(409, ERROR_CODES.managerNameTaken, "Conflict", "This club name is taken."),
    );
    await expectProblem(await club.POST(post(valid)), 409, "manager.name_taken");
  });
});

describe("GET /api/v1/manager/player", () => {
  it("asks for the id and answers 404 for a player that is not the caller's", async () => {
    await expectProblem(
      await player.GET(apiRequest("/api/v1/manager/player?id=not-an-id")),
      422,
      "api.validation_failed",
    );
    getMyPlayer.mockRejectedValueOnce(
      new ApiError(404, ERROR_CODES.notFound, "Not Found", "Player not found."),
    );
    await expectProblem(
      await player.GET(apiRequest(`/api/v1/manager/player?id=${PLAYER}`)),
      404,
      "api.not_found",
    );
  });
});
