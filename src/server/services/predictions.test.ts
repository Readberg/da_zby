// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getPredictionsPage, savePredictions } from "./predictions";
import { fakeDb } from "./fake-db";

const USER = "99999999-9999-4999-8999-999999999999";
const TOURNAMENT = "22222222-2222-4222-8222-222222222222";
const SEASON = "11111111-1111-4111-8111-111111111111";
const T1 = "44444444-4444-4444-8444-444444444441";
const T2 = "44444444-4444-4444-8444-444444444442";
const M1 = "55555555-5555-4555-8555-555555555551";
const M2 = "55555555-5555-4555-8555-555555555552";
const A = "33333333-3333-4333-8333-333333333331";
const B = "33333333-3333-4333-8333-333333333332";
const NOW = new Date("2026-10-30T00:00:00Z");

const catalogue = () => ({
  tournaments: { data: [{ id: TOURNAMENT, slug: "vysshaya-liga", name: "Высшая лига" }] },
  seasons: {
    data: [
      {
        id: "old",
        name: "2025",
        status: "closed",
        tournament_id: TOURNAMENT,
        created_at: "2025-01-01T00:00:00Z",
      },
      {
        id: SEASON,
        name: "2026",
        status: "active",
        tournament_id: TOURNAMENT,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
  },
  clubs: {
    data: [
      { id: A, name: "Динамо", logo_path: null },
      { id: B, name: "БАТЭ", logo_path: "b.png" },
    ],
  },
});
const tours = {
  data: [
    { id: T1, season_id: SEASON, number: 1, title: null, deadline_override: null },
    { id: T2, season_id: SEASON, number: 2, title: "Финал", deadline_override: null },
  ],
};
const match = (id: string, tour: string, kickoff: string, over: Record<string, unknown> = {}) => ({
  id,
  tour_id: tour,
  home_club_id: A,
  away_club_id: B,
  kickoff_at: kickoff,
  status: "scheduled",
  home_score: null,
  away_score: null,
  ...over,
});

describe("getPredictionsPage", () => {
  const tables = (extra: Record<string, unknown> = {}) =>
    ({
      ...catalogue(),
      tours,
      matches: {
        data: [
          match(M1, T1, "2026-10-01T15:00:00Z", {
            status: "finished",
            home_score: 2,
            away_score: 1,
          }),
          match(M2, T2, "2026-11-05T15:00:00Z"),
        ],
      },
      predictions: { data: [] },
      ...extra,
    }) as Parameters<typeof fakeDb>[0];

  it("opens the active season and the first tour whose deadline is still ahead", async () => {
    const { db } = fakeDb(tables());
    const page = await getPredictionsPage(db, null, {}, NOW);
    expect(page.tournament?.slug).toBe("vysshaya-liga");
    expect(page.season?.id).toBe(SEASON);
    expect(page.seasons.map((s) => s.id)).toEqual([SEASON, "old"]);
    expect(page.tour).toMatchObject({
      id: T2,
      number: 2,
      open: true,
      deadlineAt: "2026-11-05T14:50:00.000Z",
    });
    expect(page.matches).toHaveLength(1);
  });

  it("opens the tour asked for and shows its result and my prediction", async () => {
    const { db } = fakeDb(
      tables({
        predictions: {
          data: [{ match_id: M1, home_score: 2, away_score: 1, result: "exact", points: 3 }],
        },
      }),
    );
    const page = await getPredictionsPage(db, USER, { tour: 1 }, NOW);
    expect(page.tour).toMatchObject({ id: T1, open: false });
    expect(page.matches[0]).toMatchObject({
      status: "finished",
      homeScore: 2,
      awayScore: 1,
      editable: false,
      prediction: { homeScore: 2, awayScore: 1, result: "exact", points: 3 },
    });
    expect(page.matches[0]!.away.logoUrl).toContain("/club-logos/b.png");
  });

  it("makes only scheduled and postponed matches of an open tour editable", async () => {
    const { db } = fakeDb(
      tables({
        matches: {
          data: [
            match(M2, T2, "2026-11-05T15:00:00Z"),
            match("m3", T2, "2026-11-05T17:00:00Z", { status: "cancelled" }),
          ],
        },
      }),
    );
    const page = await getPredictionsPage(db, USER, {}, NOW);
    expect(page.matches.map((m) => m.editable)).toEqual([true, false]);
  });

  it("is not editable once the deadline passed or the season is closed", async () => {
    const late = fakeDb(tables());
    const afterDeadline = await getPredictionsPage(
      late.db,
      USER,
      {},
      new Date("2026-11-05T14:50:00Z"),
    );
    expect(afterDeadline.tour?.open).toBe(false);
    expect(afterDeadline.matches.every((m) => !m.editable)).toBe(true);

    const closed = fakeDb(tables());
    const page = await getPredictionsPage(closed.db, USER, { season: "old" }, NOW);
    expect(page.season?.status).toBe("closed");
    expect(page.tour?.open ?? false).toBe(false);
  });

  it("falls back to the first active tournament for an unknown slug and survives an empty catalogue", async () => {
    const { db } = fakeDb(tables());
    expect((await getPredictionsPage(db, null, { tournament: "nope" }, NOW)).tournament?.slug).toBe(
      "vysshaya-liga",
    );

    const empty = fakeDb({ tournaments: { data: [] }, seasons: { data: [] }, clubs: { data: [] } });
    const page = await getPredictionsPage(empty.db, null, {}, NOW);
    expect(page).toMatchObject({ tournament: null, season: null, tour: null, matches: [] });
  });

  it("does not ask for predictions of guests", async () => {
    const fake = fakeDb(tables());
    await getPredictionsPage(fake.db, null, {}, NOW);
    expect(fake.calls.predictions).toBeUndefined();
  });
});

describe("savePredictions", () => {
  const body = {
    tourId: T2,
    items: [
      { matchId: M1, homeScore: 2, awayScore: 1 },
      { matchId: M2, homeScore: 0, awayScore: 0 },
    ],
  };

  it("inserts new predictions and updates existing ones", async () => {
    const fake = fakeDb({
      matches: { data: [{ id: M1 }, { id: M2 }] },
      predictions: { data: [{ id: "p1", match_id: M1 }] },
    });
    await expect(savePredictions(fake.db, USER, body)).resolves.toEqual({ saved: 2 });
    expect(fake.payload("predictions", "insert")).toEqual([
      { user_id: USER, match_id: M2, home_score: 0, away_score: 0 },
    ]);
    expect(fake.calls.predictions!.find((c) => c.method === "update")!.args[0]).toEqual({
      home_score: 2,
      away_score: 1,
    });
  });

  it("refuses a match that is not in the tour", async () => {
    const { db } = fakeDb({ matches: { data: [{ id: M1 }] } });
    await expect(savePredictions(db, USER, body)).rejects.toMatchObject({
      status: 422,
      errors: [{ field: M2 }],
    });
  });

  it("answers 409 when the database refuses the insert (deadline passed)", async () => {
    const { db } = fakeDb({
      matches: { data: [{ id: M1 }, { id: M2 }] },
      predictions: { data: [], writeError: { code: "42501", message: "row-level security" } },
    });
    await expect(savePredictions(db, USER, body)).rejects.toMatchObject({
      status: 409,
      code: "predictions.closed",
    });
  });

  it("answers 409 when an update matches nothing (hidden by RLS after the deadline)", async () => {
    const { db } = fakeDb({
      matches: { data: [{ id: M1 }] },
      predictions: { data: [{ id: "p1", match_id: M1 }], writeData: [] },
    });
    await expect(
      savePredictions(db, USER, {
        tourId: T2,
        items: [{ matchId: M1, homeScore: 1, awayScore: 1 }],
      }),
    ).rejects.toMatchObject({ status: 409, code: "predictions.closed" });
  });

  it("passes unexpected database errors through", async () => {
    const { db } = fakeDb({
      matches: { data: [{ id: M1 }, { id: M2 }] },
      predictions: { data: [], writeError: { code: "XX000", message: "boom" } },
    });
    await expect(savePredictions(db, USER, body)).rejects.toMatchObject({ message: "boom" });
  });
});
