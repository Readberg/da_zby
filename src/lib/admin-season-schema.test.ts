import { describe, expect, it } from "vitest";
import {
  matchCreateSchema,
  matchUpdateSchema,
  seasonClubsBodySchema,
  seasonCreateSchema,
  tourCreateSchema,
  tourUpdateSchema,
} from "./admin-season-schema";

const A = "33333333-3333-4333-8333-333333333331";
const B = "33333333-3333-4333-8333-333333333332";
const T = "11111111-1111-4111-8111-111111111111";

describe("season schemas", () => {
  it("needs a tournament and a name; the copy source is optional", () => {
    expect(seasonCreateSchema.safeParse({ tournamentId: T, name: "2026" }).success).toBe(true);
    expect(
      seasonCreateSchema.safeParse({ tournamentId: T, name: "2026", copyFromSeasonId: null })
        .success,
    ).toBe(true);
    expect(seasonCreateSchema.safeParse({ tournamentId: T, name: "2" }).success).toBe(false);
    expect(seasonCreateSchema.safeParse({ tournamentId: "x", name: "2026" }).success).toBe(false);
  });

  it("limits the roster payload", () => {
    expect(seasonClubsBodySchema.safeParse({ seasonId: T, clubIds: [A, B] }).success).toBe(true);
    expect(seasonClubsBodySchema.safeParse({ seasonId: T, clubIds: ["nope"] }).success).toBe(false);
    expect(
      seasonClubsBodySchema.safeParse({
        seasonId: T,
        clubIds: Array.from({ length: 201 }, () => A),
      }).success,
    ).toBe(false);
  });
});

describe("tour schemas", () => {
  it("accepts a bare tour, a pinned deadline and an empty title", () => {
    expect(tourCreateSchema.safeParse({ seasonId: T }).success).toBe(true);
    const parsed = tourCreateSchema.parse({
      seasonId: T,
      number: 3,
      title: "  ",
      deadlineOverride: "2026-10-30T10:00:00+03:00",
    });
    expect(parsed.title).toBeNull();
  });

  it.each([0, 501, 1.5])("rejects the tour number %s", (number) => {
    expect(tourCreateSchema.safeParse({ seasonId: T, number }).success).toBe(false);
  });

  it("rejects a deadline that is not an instant with an offset", () => {
    expect(
      tourCreateSchema.safeParse({ seasonId: T, deadlineOverride: "2026-10-30" }).success,
    ).toBe(false);
    expect(tourUpdateSchema.safeParse({ id: T, deadlineOverride: null }).success).toBe(true);
  });
});

describe("match schemas", () => {
  const match = { tourId: T, homeClubId: A, awayClubId: B, kickoffAt: "2026-10-30T15:00:00Z" };

  it("accepts two different clubs", () => {
    expect(matchCreateSchema.safeParse(match).success).toBe(true);
  });

  it("rejects the same club on both sides, naming the guest field", () => {
    const result = matchCreateSchema.safeParse({ ...match, awayClubId: A });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]!.path).toEqual(["awayClubId"]);
  });

  it("rejects a kickoff without a time zone", () => {
    expect(
      matchCreateSchema.safeParse({ ...match, kickoffAt: "2026-10-30T15:00:00" }).success,
    ).toBe(false);
  });

  it("validates result fields on update", () => {
    const base = { id: T, status: "finished" as const };
    expect(matchUpdateSchema.safeParse({ ...base, homeScore: 2, awayScore: 0 }).success).toBe(true);
    expect(matchUpdateSchema.safeParse({ ...base, homeScore: 100 }).success).toBe(false);
    expect(matchUpdateSchema.safeParse({ ...base, homeScore: -1 }).success).toBe(false);
    expect(matchUpdateSchema.safeParse({ ...base, homeScore: 1.5 }).success).toBe(false);
    expect(matchUpdateSchema.safeParse({ id: T, status: "live" }).success).toBe(false);
  });
});
