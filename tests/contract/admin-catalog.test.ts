// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clubDeletedSchema,
  clubListSchema,
  clubSchema,
  recalculateResultSchema,
  tournamentListSchema,
  tournamentSchema,
} from "@/server/api/v1/schemas/admin-catalog";
import { ApiError } from "@/server/api/v1/problem";
import { apiRequest, expectProblem } from "./helpers";

const createClient = vi.fn();
const tournaments = {
  listTournaments: vi.fn(),
  createTournament: vi.fn(),
  updateTournament: vi.fn(),
  recalculateTournament: vi.fn(),
};
const clubs = {
  listClubs: vi.fn(),
  createClub: vi.fn(),
  updateClub: vi.fn(),
  deleteClub: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/server/services/admin-tournaments", () => tournaments);
vi.mock("@/server/services/admin-clubs", () => clubs);

const tournamentsRoute = await import("@/app/api/v1/admin/tournaments/route");
const recalcRoute = await import("@/app/api/v1/admin/tournaments/recalculate/route");
const clubsRoute = await import("@/app/api/v1/admin/clubs/route");

const ID = "11111111-1111-4111-8111-111111111111";
const tournament = {
  id: ID,
  name: "Высшая лига",
  slug: "vysshaya-liga",
  kind: "score_prediction",
  pointsExact: 3,
  pointsOutcome: 1,
  isActive: true,
};
const club = { id: ID, name: "Динамо", shortName: null, logoPath: null, logoUrl: null };

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
  for (const fn of [...Object.values(tournaments), ...Object.values(clubs)]) fn.mockReset();
  tournaments.listTournaments.mockResolvedValue({ items: [tournament] });
  tournaments.createTournament.mockResolvedValue(tournament);
  tournaments.updateTournament.mockResolvedValue(tournament);
  tournaments.recalculateTournament.mockResolvedValue({ seasons: 2 });
  clubs.listClubs.mockResolvedValue({ items: [club] });
  clubs.createClub.mockResolvedValue(club);
  clubs.updateClub.mockResolvedValue(club);
  clubs.deleteClub.mockResolvedValue({ id: ID });
});

const tournamentBody = {
  name: "Высшая лига",
  slug: "vysshaya-liga",
  pointsExact: 3,
  pointsOutcome: 1,
  isActive: true,
};

const operations: [string, () => Promise<Response>][] = [
  ["GET /admin/tournaments", () => tournamentsRoute.GET(call("/admin/tournaments", "GET"))],
  [
    "POST /admin/tournaments",
    () => tournamentsRoute.POST(call("/admin/tournaments", "POST", tournamentBody)),
  ],
  [
    "PATCH /admin/tournaments",
    () => tournamentsRoute.PATCH(call("/admin/tournaments", "PATCH", { id: ID, pointsExact: 4 })),
  ],
  [
    "POST /admin/tournaments/recalculate",
    () => recalcRoute.POST(call("/admin/tournaments/recalculate", "POST", { tournamentId: ID })),
  ],
  ["GET /admin/clubs", () => clubsRoute.GET(call("/admin/clubs", "GET"))],
  [
    "POST /admin/clubs",
    () =>
      clubsRoute.POST(
        call("/admin/clubs", "POST", { name: "Динамо", shortName: "", logoPath: null }),
      ),
  ],
  [
    "PATCH /admin/clubs",
    () => clubsRoute.PATCH(call("/admin/clubs", "PATCH", { id: ID, name: "Динамо" })),
  ],
  ["DELETE /admin/clubs", () => clubsRoute.DELETE(call("/admin/clubs", "DELETE", { id: ID }))],
];

describe("admin catalog endpoints are closed to everybody but admins", () => {
  it.each(operations)("%s", async (_name, run) => {
    client("guest");
    await expectProblem(await run(), 401, "auth.required");
    client("user");
    await expectProblem(await run(), 403, "auth.forbidden");
    for (const fn of [...Object.values(tournaments), ...Object.values(clubs)]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe("tournaments", () => {
  it("lists, creates, updates and re-grades for an admin", async () => {
    client("admin");
    tournamentListSchema.parse((await (await operations[0]![1]()).json()).data);
    tournamentSchema.parse((await (await operations[1]![1]()).json()).data);
    tournamentSchema.parse((await (await operations[2]![1]()).json()).data);
    recalculateResultSchema.parse((await (await operations[3]![1]()).json()).data);
    expect(tournaments.createTournament).toHaveBeenCalledWith(expect.anything(), tournamentBody);
    expect(tournaments.updateTournament).toHaveBeenCalledWith(expect.anything(), {
      id: ID,
      pointsExact: 4,
    });
    expect(tournaments.recalculateTournament).toHaveBeenCalledWith(expect.anything(), ID);
  });

  it("validates the body with field errors", async () => {
    client("admin");
    const response = await tournamentsRoute.POST(
      call("/admin/tournaments", "POST", { ...tournamentBody, slug: "Bad Slug", pointsExact: -1 }),
    );
    const problem = await expectProblem(response, 422, "api.validation_failed");
    expect(problem.errors?.map((e) => e.field).sort()).toEqual(["pointsExact", "slug"]);
    expect(tournaments.createTournament).not.toHaveBeenCalled();
  });

  it("passes a duplicate through as 409 with the field", async () => {
    client("admin");
    tournaments.createTournament.mockRejectedValue(
      new ApiError(409, "admin.duplicate", "Conflict", "exists", [
        { field: "slug", message: "Такой slug уже занят" },
      ]),
    );
    const problem = await expectProblem(await operations[1]![1](), 409, "admin.duplicate");
    expect(problem.errors).toEqual([{ field: "slug", message: "Такой slug уже занят" }]);
  });
});

describe("clubs", () => {
  it("lists, creates, updates and deletes for an admin", async () => {
    client("admin");
    clubListSchema.parse((await (await operations[4]![1]()).json()).data);
    clubSchema.parse((await (await operations[5]![1]()).json()).data);
    clubSchema.parse((await (await operations[6]![1]()).json()).data);
    clubDeletedSchema.parse((await (await operations[7]![1]()).json()).data);
    expect(clubs.createClub).toHaveBeenCalledWith(expect.anything(), {
      name: "Динамо",
      shortName: null,
      logoPath: null,
    });
  });

  it("refuses a logo path outside the expected shape", async () => {
    client("admin");
    const response = await clubsRoute.POST(
      call("/admin/clubs", "POST", { name: "Динамо", shortName: null, logoPath: "../secret.png" }),
    );
    await expectProblem(response, 422, "api.validation_failed");
    expect(clubs.createClub).not.toHaveBeenCalled();
  });

  it("reports a club in use as 409", async () => {
    client("admin");
    clubs.deleteClub.mockRejectedValue(new ApiError(409, "admin.in_use", "Conflict", "in use"));
    await expectProblem(await operations[7]![1](), 409, "admin.in_use");
  });
});
