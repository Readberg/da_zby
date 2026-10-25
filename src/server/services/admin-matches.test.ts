// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createMatch,
  createTour,
  deleteMatch,
  deleteTour,
  getTour,
  updateMatch,
  updateTour,
} from "./admin-matches";
import { fakeDb } from "./fake-db";

const SEASON = "11111111-1111-4111-8111-111111111111";
const TOUR = "44444444-4444-4444-8444-444444444444";
const MATCH = "55555555-5555-4555-8555-555555555555";
const A = "33333333-3333-4333-8333-333333333331";
const B = "33333333-3333-4333-8333-333333333332";
const C = "33333333-3333-4333-8333-333333333333";

const season = (status = "active") => ({ id: SEASON, name: "2026", status });
const tour = { id: TOUR, season_id: SEASON, number: 3, title: null, deadline_override: null };
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
const base = () => ({
  seasons: { data: [season()] },
  tours: { data: [tour] },
  matches: { data: [matchRow()] },
  season_clubs: { data: [{ club_id: A }, { club_id: B }] },
  clubs: {
    data: [
      { id: A, name: "Динамо" },
      { id: B, name: "БАТЭ" },
    ],
  },
});

describe("tours", () => {
  it("defaults the number to the next free one", async () => {
    const fake = fakeDb({ ...base(), tours: { data: [{ ...tour, number: 7 }] } });
    await createTour(fake.db, { seasonId: SEASON });
    expect(fake.payload("tours", "insert")).toMatchObject({ season_id: SEASON, number: 8 });
  });

  it("uses the given number, title and pinned deadline", async () => {
    const fake = fakeDb(base());
    await createTour(fake.db, {
      seasonId: SEASON,
      number: 2,
      title: "1/16 финала",
      deadlineOverride: "2026-10-30T10:00:00.000Z",
    });
    expect(fake.payload("tours", "insert")).toEqual({
      season_id: SEASON,
      number: 2,
      title: "1/16 финала",
      deadline_override: "2026-10-30T10:00:00.000Z",
    });
  });

  it("marks the number field when it is taken, and is refused in a closed season", async () => {
    const taken = fakeDb({ ...base(), tours: { error: { code: "23505", message: "dup" } } });
    await expect(createTour(taken.db, { seasonId: SEASON, number: 1 })).rejects.toMatchObject({
      status: 409,
      errors: [{ field: "number" }],
    });
    const closed = fakeDb({ ...base(), seasons: { data: [season("closed")] } });
    await expect(createTour(closed.db, { seasonId: SEASON, number: 1 })).rejects.toMatchObject({
      code: "admin.season_closed",
    });
  });

  it("updates only the given fields and answers 404 for an unknown tour", async () => {
    const fake = fakeDb(base());
    await updateTour(fake.db, { id: TOUR, title: "Финал", deadlineOverride: null });
    expect(fake.payload("tours", "update")).toEqual({ title: "Финал", deadline_override: null });

    const unknown = fakeDb({ ...base(), tours: { data: [] } });
    await expect(updateTour(unknown.db, { id: TOUR, number: 2 })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("does not delete a tour that has matches", async () => {
    const withMatches = fakeDb({ ...base(), matches: { data: [matchRow()], count: 2 } });
    await expect(deleteTour(withMatches.db, TOUR)).rejects.toMatchObject({
      status: 409,
      code: "admin.in_use",
    });
    const empty = fakeDb({ ...base(), matches: { data: [], count: 0 } });
    await expect(deleteTour(empty.db, TOUR)).resolves.toEqual({ id: TOUR });
  });
});

describe("getTour", () => {
  it("lists matches with club names and the roster of the season", async () => {
    const { db } = fakeDb(base(), { tour_deadline: { data: "2026-10-30T14:50:00+00:00" } });
    const detail = await getTour(db, TOUR);
    expect(detail.season).toEqual({ id: SEASON, name: "2026", status: "active" });
    expect(detail.tour.deadlineAt).toBe("2026-10-30T14:50:00.000Z");
    expect(detail.clubs.map((c) => c.name)).toEqual(["Динамо", "БАТЭ"]);
    expect(detail.matches[0]).toMatchObject({
      homeName: "Динамо",
      awayName: "БАТЭ",
      status: "scheduled",
      homeScore: null,
    });
  });
});

describe("createMatch", () => {
  it("creates a match between two clubs of the roster, storing UTC", async () => {
    const fake = fakeDb(base());
    await createMatch(fake.db, {
      tourId: TOUR,
      homeClubId: A,
      awayClubId: B,
      kickoffAt: "2026-10-30T18:00:00+03:00",
    });
    expect(fake.payload("matches", "insert")).toEqual({
      tour_id: TOUR,
      home_club_id: A,
      away_club_id: B,
      kickoff_at: "2026-10-30T15:00:00.000Z",
    });
  });

  it("refuses a club that is not in the season roster, naming the field", async () => {
    const { db } = fakeDb(base());
    await expect(
      createMatch(db, {
        tourId: TOUR,
        homeClubId: A,
        awayClubId: C,
        kickoffAt: "2026-10-30T15:00:00Z",
      }),
    ).rejects.toMatchObject({ status: 422, errors: [{ field: "awayClubId" }] });
  });
});

describe("updateMatch", () => {
  it("enters a result: finished with both scores", async () => {
    const fake = fakeDb(base());
    await updateMatch(fake.db, { id: MATCH, status: "finished", homeScore: 2, awayScore: 1 });
    expect(fake.payload("matches", "update")).toMatchObject({
      status: "finished",
      home_score: 2,
      away_score: 1,
    });
  });

  it("requires both scores for a finished match", async () => {
    const { db } = fakeDb(base());
    await expect(
      updateMatch(db, { id: MATCH, status: "finished", homeScore: 2 }),
    ).rejects.toMatchObject({
      status: 422,
      errors: [{ field: "awayScore" }],
    });
  });

  it("clears the scores when the status is not finished any more", async () => {
    const fake = fakeDb({
      ...base(),
      matches: { data: [matchRow({ status: "finished", home_score: 1, away_score: 0 })] },
    });
    await updateMatch(fake.db, { id: MATCH, status: "postponed", homeScore: 5, awayScore: 5 });
    expect(fake.payload("matches", "update")).toMatchObject({
      status: "postponed",
      home_score: null,
      away_score: null,
    });
  });

  it("keeps an existing result when only the kickoff changes", async () => {
    const fake = fakeDb({
      ...base(),
      matches: { data: [matchRow({ status: "finished", home_score: 1, away_score: 0 })] },
    });
    await updateMatch(fake.db, { id: MATCH, kickoffAt: "2026-11-01T10:00:00Z" });
    expect(fake.payload("matches", "update")).toMatchObject({
      kickoff_at: "2026-11-01T10:00:00.000Z",
      status: "finished",
      home_score: 1,
      away_score: 0,
    });
  });

  it("refuses the same club on both sides and a club outside the roster", async () => {
    const { db } = fakeDb(base());
    await expect(updateMatch(db, { id: MATCH, awayClubId: A })).rejects.toMatchObject({
      status: 422,
      errors: [{ field: "awayClubId" }],
    });
    await expect(updateMatch(db, { id: MATCH, awayClubId: C })).rejects.toMatchObject({
      status: 422,
    });
  });

  it("is refused in a closed season and answers 404 for an unknown match", async () => {
    const closed = fakeDb({ ...base(), seasons: { data: [season("closed")] } });
    await expect(updateMatch(closed.db, { id: MATCH, status: "cancelled" })).rejects.toMatchObject({
      code: "admin.season_closed",
    });
    const unknown = fakeDb({ ...base(), matches: { data: [] } });
    await expect(updateMatch(unknown.db, { id: MATCH, status: "cancelled" })).rejects.toMatchObject(
      {
        status: 404,
      },
    );
  });
});

describe("deleteMatch", () => {
  it("deletes a match nobody predicted", async () => {
    const { db } = fakeDb({
      ...base(),
      matches: { data: [{ id: MATCH, tour_id: TOUR }] },
      predictions: { data: [], count: 0 },
    });
    await expect(deleteMatch(db, MATCH)).resolves.toEqual({ id: MATCH });
  });

  it("refuses to delete a match that has predictions", async () => {
    const { db } = fakeDb({
      ...base(),
      matches: { data: [{ id: MATCH, tour_id: TOUR }] },
      predictions: { data: [{ id: "p" }], count: 3 },
    });
    await expect(deleteMatch(db, MATCH)).rejects.toMatchObject({
      status: 409,
      code: "admin.in_use",
    });
  });
});
