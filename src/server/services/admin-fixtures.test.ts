// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Fixture } from "@/lib/fixtures-plan";
import { ApiError } from "@/server/api/v1/problem";
import { applyFixtures, previewFixtures } from "./admin-fixtures";
import { fakeDb } from "./fake-db";
import { FixturesSourceError } from "./fixtures-source";

const SEASON = "11111111-1111-4111-8111-111111111111";
const TOUR = "44444444-4444-4444-8444-444444444444";
const MATCH = "55555555-5555-4555-8555-555555555555";
const A = "33333333-3333-4333-8333-333333333331";
const B = "33333333-3333-4333-8333-333333333332";
const NOW = new Date("2026-10-27T12:00:00Z");

const fixture = (over: Partial<Fixture> = {}): Fixture => ({
  home: "Dinamo Minsk",
  away: "BATE Borisov",
  kickoffAt: "2026-10-30T15:00:00.000Z",
  status: "scheduled",
  homeScore: null,
  awayScore: null,
  ...over,
});

const matchRow = (over: Record<string, unknown> = {}) => ({
  id: MATCH,
  tour_id: TOUR,
  home_club_id: A,
  away_club_id: B,
  kickoff_at: "2026-10-30T15:00:00+00:00",
  status: "scheduled",
  home_score: null,
  away_score: null,
  ...over,
});

const tables = (over: Record<string, unknown> = {}) =>
  ({
    seasons: { data: [{ id: SEASON, name: "2026", status: "active" }] },
    tours: {
      data: [{ id: TOUR, season_id: SEASON, number: 3, title: null, deadline_override: null }],
    },
    matches: { data: [] as unknown[], writeData: [matchRow()] },
    season_clubs: { data: [{ club_id: A }, { club_id: B }] },
    clubs: {
      data: [
        { id: A, name: "Динамо Минск" },
        { id: B, name: "БАТЭ" },
      ],
    },
    ...over,
  }) as Parameters<typeof fakeDb>[0];

const source = (fixtures: Fixture[]) => ({ fetchRound: vi.fn(async () => fixtures) });

describe("previewFixtures", () => {
  it("asks the source for the round of the tour in the season's year and plans the import", async () => {
    const deps = source([fixture()]);
    const { db } = fakeDb(tables());
    const preview = await previewFixtures(db, { tourId: TOUR }, deps, NOW);
    expect(deps.fetchRound).toHaveBeenCalledWith({ season: "2026", round: 3, apiKey: undefined });
    expect(preview).toMatchObject({ source: "TheSportsDB", season: "2026", round: 3 });
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]).toMatchObject({
      action: "create",
      homeName: "Динамо Минск",
      awayName: "БАТЭ",
    });
    // The internal club ids stay inside.
    expect(preview.rows[0]).not.toHaveProperty("homeClubId");
  });

  it("takes an explicit round and the key it is given", async () => {
    const deps = { ...source([]), apiKey: "own-key" };
    const { db } = fakeDb(tables());
    await previewFixtures(db, { tourId: TOUR, round: 9 }, deps, NOW);
    expect(deps.fetchRound).toHaveBeenCalledWith({ season: "2026", round: 9, apiKey: "own-key" });
  });

  it("uses this year when the season is not named after a year", async () => {
    const deps = source([]);
    const { db } = fakeDb(
      tables({ seasons: { data: [{ id: SEASON, name: "Осень", status: "active" }] } }),
    );
    await previewFixtures(db, { tourId: TOUR }, deps, NOW);
    expect(deps.fetchRound).toHaveBeenCalledWith(expect.objectContaining({ season: "2026" }));
  });

  it("says 502 when the source fails", async () => {
    const deps = {
      fetchRound: vi.fn(async () => {
        throw new FixturesSourceError("The source did not answer");
      }),
    };
    const { db } = fakeDb(tables());
    const error = await previewFixtures(db, { tourId: TOUR }, deps, NOW).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: "fixtures.unavailable" });
  });
});

describe("applyFixtures", () => {
  it("creates the confirmed match", async () => {
    const deps = source([fixture()]);
    const fake = fakeDb(tables());
    const result = await applyFixtures(
      fake.db,
      { tourId: TOUR, keys: ["Dinamo Minsk|BATE Borisov"] },
      deps,
      NOW,
    );
    expect(result).toEqual({ created: 1, updated: 0, skipped: [] });
    const insert = fake.calls.matches?.find((call) => call.method === "insert");
    expect(insert?.args[0]).toMatchObject({
      tour_id: TOUR,
      home_club_id: A,
      away_club_id: B,
      kickoff_at: "2026-10-30T15:00:00.000Z",
    });
  });

  it("updates an existing match with the result", async () => {
    const deps = source([fixture({ status: "finished", homeScore: 2, awayScore: 1 })]);
    const fake = fakeDb(
      tables({ matches: { data: [matchRow()], writeData: [matchRow({ status: "finished" })] } }),
    );
    const result = await applyFixtures(
      fake.db,
      { tourId: TOUR, keys: ["Dinamo Minsk|BATE Borisov"] },
      deps,
      NOW,
    );
    expect(result).toEqual({ created: 0, updated: 1, skipped: [] });
    const update = fake.calls.matches?.find((call) => call.method === "update");
    expect(update?.args[0]).toMatchObject({ status: "finished", home_score: 2, away_score: 1 });
  });

  it("skips what the source does not have, what is blocked and what is unchanged", async () => {
    const deps = source([fixture(), fixture({ home: "Dynamo Brest", away: "BATE Borisov" })]);
    const fake = fakeDb(tables({ matches: { data: [matchRow()], writeData: [matchRow()] } }));
    const result = await applyFixtures(
      fake.db,
      {
        tourId: TOUR,
        keys: ["Nobody|Nobody", "Dynamo Brest|BATE Borisov", "Dinamo Minsk|BATE Borisov"],
      },
      deps,
      NOW,
    );
    expect(result.created + result.updated).toBe(0);
    expect(result.skipped.map((s) => s.key)).toEqual([
      "Nobody|Nobody",
      "Dynamo Brest|BATE Borisov",
      "Dinamo Minsk|BATE Borisov",
    ]);
    expect(result.skipped[0]?.reason).toMatch(/нет в источнике/);
    expect(result.skipped[1]?.reason).toMatch(/не найден/);
    expect(result.skipped[2]?.reason).toMatch(/нечего/);
    expect(fake.calls.matches?.some((call) => call.method === "insert")).toBeFalsy();
  });

  it("refuses to change a closed season", async () => {
    const deps = source([fixture()]);
    const fake = fakeDb(
      tables({ seasons: { data: [{ id: SEASON, name: "2026", status: "closed" }] } }),
    );
    await expect(
      applyFixtures(fake.db, { tourId: TOUR, keys: ["Dinamo Minsk|BATE Borisov"] }, deps, NOW),
    ).rejects.toMatchObject({ status: 409 });
  });
});
