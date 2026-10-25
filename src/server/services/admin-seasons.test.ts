// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  assertSeasonOpen,
  closeSeason,
  createSeason,
  getSeason,
  listSeasons,
  recalculateSeason,
  reopenSeason,
  setSeasonClubs,
} from "./admin-seasons";
import { fakeDb } from "./fake-db";

const SEASON = "11111111-1111-4111-8111-111111111111";
const TOURNAMENT = "22222222-2222-4222-8222-222222222222";
const CLUB_A = "33333333-3333-4333-8333-333333333331";
const CLUB_B = "33333333-3333-4333-8333-333333333332";

const season = (status = "active") => ({
  id: SEASON,
  tournament_id: TOURNAMENT,
  name: "2026",
  status,
  closed_at: status === "closed" ? "2026-10-25T10:00:00+00:00" : null,
  created_at: "2026-10-24T10:00:00+00:00",
});

describe("assertSeasonOpen", () => {
  it("lets an active season through", async () => {
    await expect(
      assertSeasonOpen(fakeDb({ seasons: { data: [season()] } }).db, SEASON),
    ).resolves.toBeUndefined();
  });

  it("refuses a closed season with 409 admin.season_closed", async () => {
    const { db } = fakeDb({ seasons: { data: [season("closed")] } });
    await expect(assertSeasonOpen(db, SEASON)).rejects.toMatchObject({
      status: 409,
      code: "admin.season_closed",
    });
  });

  it("answers 404 for an unknown season", async () => {
    await expect(
      assertSeasonOpen(fakeDb({ seasons: { data: [] } }).db, SEASON),
    ).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("listSeasons", () => {
  it("counts clubs and tours per season and names the tournament", async () => {
    const { db } = fakeDb({
      seasons: { data: [season()] },
      tournaments: { data: [{ id: TOURNAMENT, name: "Высшая лига" }] },
      season_clubs: { data: [{ season_id: SEASON }, { season_id: SEASON }] },
      tours: { data: [{ season_id: SEASON }] },
    });
    const { items } = await listSeasons(db);
    expect(items).toEqual([
      {
        id: SEASON,
        tournamentId: TOURNAMENT,
        tournamentName: "Высшая лига",
        name: "2026",
        status: "active",
        closedAt: null,
        clubsCount: 2,
        toursCount: 1,
      },
    ]);
  });
});

describe("createSeason", () => {
  const tables = () => ({
    tournaments: { data: [{ id: TOURNAMENT, name: "Высшая лига" }] },
    seasons: { data: [season()] },
    season_clubs: { data: [{ club_id: CLUB_A }, { club_id: CLUB_B }] },
  });

  it("creates a season and copies the roster of another one", async () => {
    const fake = fakeDb(tables());
    const created = await createSeason(fake.db, {
      tournamentId: TOURNAMENT,
      name: "2026",
      copyFromSeasonId: SEASON,
    });
    expect(created.clubsCount).toBe(2);
    expect(fake.payload("season_clubs", "insert")).toEqual([
      { season_id: SEASON, club_id: CLUB_A },
      { season_id: SEASON, club_id: CLUB_B },
    ]);
  });

  it("does not touch the roster without a copy source", async () => {
    const fake = fakeDb(tables());
    const created = await createSeason(fake.db, { tournamentId: TOURNAMENT, name: "2026" });
    expect(created.clubsCount).toBe(0);
    expect(fake.calls.season_clubs).toBeUndefined();
  });

  it("answers 404 for an unknown tournament", async () => {
    const { db } = fakeDb({ ...tables(), tournaments: { data: [] } });
    await expect(
      createSeason(db, { tournamentId: TOURNAMENT, name: "2026" }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it("marks the name field when the season name is taken", async () => {
    const { db } = fakeDb({
      ...tables(),
      seasons: { error: { code: "23505", message: "duplicate" } },
    });
    await expect(
      createSeason(db, { tournamentId: TOURNAMENT, name: "2026" }),
    ).rejects.toMatchObject({
      status: 409,
      code: "admin.duplicate",
      errors: [{ field: "name" }],
    });
  });
});

describe("getSeason", () => {
  it("returns the roster and the tours with deadlines and match counts", async () => {
    const { db } = fakeDb(
      {
        seasons: { data: [season()] },
        tournaments: { data: [{ name: "Высшая лига" }] },
        season_clubs: { data: [{ club_id: CLUB_A }] },
        tours: {
          data: [
            {
              id: "t1",
              season_id: SEASON,
              number: 1,
              title: null,
              deadline_override: null,
            },
          ],
        },
        matches: { data: [{ tour_id: "t1" }, { tour_id: "t1" }] },
      },
      { tour_deadline: { data: "2026-10-30T14:50:00+00:00" } },
    );
    const detail = await getSeason(db, SEASON);
    expect(detail.clubIds).toEqual([CLUB_A]);
    expect(detail.tours).toEqual([
      {
        id: "t1",
        seasonId: SEASON,
        number: 1,
        title: null,
        deadlineOverride: null,
        deadlineAt: "2026-10-30T14:50:00.000Z",
        matchesCount: 2,
      },
    ]);
    expect(detail.season.toursCount).toBe(1);
  });
});

describe("setSeasonClubs", () => {
  it("adds and removes clubs to match the wanted roster", async () => {
    const fake = fakeDb({
      seasons: { data: [season()] },
      season_clubs: { data: [{ club_id: CLUB_A }] },
      tours: { data: [] },
    });
    await expect(setSeasonClubs(fake.db, { seasonId: SEASON, clubIds: [CLUB_B] })).resolves.toEqual(
      {
        clubIds: [CLUB_B],
      },
    );
    expect(fake.payload("season_clubs", "insert")).toEqual([
      { season_id: SEASON, club_id: CLUB_B },
    ]);
    expect(fake.calls.season_clubs!.some((c) => c.method === "delete")).toBe(true);
  });

  it("refuses to remove a club that already plays a match of the season", async () => {
    const { db } = fakeDb({
      seasons: { data: [season()] },
      season_clubs: { data: [{ club_id: CLUB_A }] },
      tours: { data: [{ id: "t1" }] },
      matches: { data: [{ home_club_id: CLUB_A, away_club_id: CLUB_B }] },
    });
    await expect(setSeasonClubs(db, { seasonId: SEASON, clubIds: [] })).rejects.toMatchObject({
      status: 409,
      code: "admin.in_use",
    });
  });

  it("is refused for a closed season", async () => {
    const { db } = fakeDb({ seasons: { data: [season("closed")] } });
    await expect(setSeasonClubs(db, { seasonId: SEASON, clubIds: [CLUB_A] })).rejects.toMatchObject(
      {
        code: "admin.season_closed",
      },
    );
  });
});

describe("closing, reopening and re-grading", () => {
  it("closes an active season through the database function", async () => {
    const fake = fakeDb({ seasons: { data: [season()] } });
    await expect(closeSeason(fake.db, SEASON)).resolves.toEqual({
      seasonId: SEASON,
      status: "closed",
    });
    expect(fake.rpc).toHaveBeenCalledWith("close_season", { p_season_id: SEASON });
  });

  it("refuses to close a closed season and to reopen an active one", async () => {
    const closed = fakeDb({ seasons: { data: [season("closed")] } });
    await expect(closeSeason(closed.db, SEASON)).rejects.toMatchObject({
      status: 409,
      code: "admin.season_state",
    });
    expect(closed.rpc).not.toHaveBeenCalled();

    const active = fakeDb({ seasons: { data: [season()] } });
    await expect(reopenSeason(active.db, SEASON)).rejects.toMatchObject({
      code: "admin.season_state",
    });
  });

  it("reopens a closed season and re-grades on request", async () => {
    const closed = fakeDb({ seasons: { data: [season("closed")] } });
    await expect(reopenSeason(closed.db, SEASON)).resolves.toMatchObject({ status: "active" });
    expect(closed.rpc).toHaveBeenCalledWith("reopen_season", { p_season_id: SEASON });

    const active = fakeDb({ seasons: { data: [season()] } });
    await expect(recalculateSeason(active.db, SEASON)).resolves.toEqual({ seasonId: SEASON });
    expect(active.rpc).toHaveBeenCalledWith("recalculate_season", { p_season_id: SEASON });
  });

  it("passes database errors through", async () => {
    const { db } = fakeDb(
      { seasons: { data: [season()] } },
      { close_season: { error: { message: "forbidden", code: "42501" } } },
    );
    await expect(closeSeason(db, SEASON)).rejects.toMatchObject({ message: "forbidden" });
  });
});
