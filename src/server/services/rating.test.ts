// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fakeDb } from "./fake-db";

vi.mock("@/lib/env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
}));

const { getProfileStats, getRatingPage, toRatingRows, winRate } = await import("./rating");

const TOURNAMENT = "22222222-2222-4222-8222-222222222222";
const SEASON = "11111111-1111-4111-8111-111111111111";
const T1 = "44444444-4444-4444-8444-444444444441";
const M1 = "55555555-5555-4555-8555-555555555551";
const U1 = "99999999-9999-4999-8999-999999999991";
const U2 = "99999999-9999-4999-8999-999999999992";
const U3 = "99999999-9999-4999-8999-999999999993";

const entry = (user: string, nickname: string | null, over: Record<string, unknown> = {}) => ({
  user_id: user,
  exact_count: 0,
  outcome_count: 0,
  miss_count: 0,
  points: 0,
  predictions_count: 0,
  current_rank: 1,
  final_rank: null,
  profiles: { nickname, avatar_path: null },
  ...over,
});

describe("toRatingRows", () => {
  it("orders by place, then points, exact scores, outcomes and nickname; ties share a place", () => {
    const rows = toRatingRows(
      [
        entry(U3, "Яна", { current_rank: 2, points: 5, exact_count: 1 }),
        entry(U1, "Борис", { current_rank: 1, points: 7, exact_count: 2 }),
        entry(U2, "Аня", { current_rank: 2, points: 5, exact_count: 1 }),
      ],
      false,
    );
    expect(rows.map((r) => [r.nickname, r.place])).toEqual([
      ["Борис", 1],
      ["Аня", 2],
      ["Яна", 2],
    ]);
  });

  it("shows final places of a closed season and marks them", () => {
    const [row] = toRatingRows([entry(U1, "Аня", { current_rank: 3, final_rank: 1 })], true);
    expect(row).toMatchObject({ place: 1, final: true });
  });

  it("keeps the current place of an open season even if a final one exists", () => {
    const [row] = toRatingRows([entry(U1, "Аня", { current_rank: 3, final_rank: 1 })], false);
    expect(row).toMatchObject({ place: 3, final: false });
  });

  it("copes with missing counts, nicknames and null users", () => {
    const rows = toRatingRows(
      [
        { ...entry(U1, null), exact_count: null, points: null, profiles: null },
        { ...entry(U2, "x"), user_id: null },
      ],
      false,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ nickname: null, points: 0, exactCount: 0 });
  });
});

describe("winRate", () => {
  it("is the share of graded predictions that were won, with one decimal", () => {
    expect(winRate(2, 1)).toBe(66.7);
    expect(winRate(3, 0)).toBe(100);
    expect(winRate(0, 4)).toBe(0);
  });

  it("is null while nothing is graded", () => {
    expect(winRate(0, 0)).toBeNull();
  });
});

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
});

describe("getRatingPage", () => {
  const seasonTables = () =>
    ({
      ...catalogue(),
      tours: { data: [{ id: T1, number: 1, title: null }] },
      season_leaderboard: {
        data: [
          entry(U2, "Аня", { current_rank: 2, points: 3, exact_count: 1 }),
          entry(U1, "Борис", { current_rank: 1, points: 4, exact_count: 1, outcome_count: 1 }),
        ],
      },
    }) as Parameters<typeof fakeDb>[0];

  it("shows the table of the active season by default", async () => {
    const { db } = fakeDb(seasonTables());
    const page = await getRatingPage(db, {});
    expect(page.season?.id).toBe(SEASON);
    expect(page.tour).toBeNull();
    expect(page.rows.map((r) => r.nickname)).toEqual(["Борис", "Аня"]);
    expect(page.tours).toEqual([{ number: 1, title: null }]);
  });

  it("adds the places gained with the latest graded tour", async () => {
    const { db } = fakeDb({
      ...seasonTables(),
      season_leaderboard: {
        data: [
          entry(U1, "Борис", { current_rank: 1, points: 4, predictions_count: 2 }),
          entry(U2, "Аня", { current_rank: 2, points: 3, predictions_count: 2 }),
        ],
      },
      matches: { data: [{ tour_id: T1 }] },
      tour_leaderboard: {
        data: [
          entry(U1, "Борис", { points: 3, predictions_count: 1 }),
          entry(U2, "Аня", { points: 0, predictions_count: 1 }),
        ],
      },
    });
    const page = await getRatingPage(db, {});
    expect(page.rows.map((r) => [r.nickname, r.trend])).toEqual([
      ["Борис", 1],
      ["Аня", -1],
    ]);
  });

  it("has no trend while no match is graded", async () => {
    const { db } = fakeDb({ ...seasonTables(), matches: { data: [] } });
    const page = await getRatingPage(db, {});
    expect(page.rows.every((r) => r.trend === null)).toBe(true);
  });

  it("shows one tour with every participant's prediction", async () => {
    const { db } = fakeDb({
      ...seasonTables(),
      tour_leaderboard: { data: [entry(U1, "Борис", { current_rank: 1, points: 3 })] },
      matches: {
        data: [
          {
            id: M1,
            tour_id: T1,
            home_club_id: "a",
            away_club_id: "b",
            kickoff_at: "2026-10-01T15:00:00Z",
            status: "finished",
            home_score: 2,
            away_score: 1,
          },
        ],
      },
      clubs: {
        data: [
          { id: "a", name: "Динамо" },
          { id: "b", name: "БАТЭ" },
        ],
      },
      predictions: {
        data: [
          { user_id: U1, match_id: M1, home_score: 2, away_score: 1, result: "exact", points: 3 },
        ],
      },
    });
    const page = await getRatingPage(db, { tour: 1 });
    expect(page.tour).toMatchObject({ id: T1, number: 1 });
    expect(page.matches[0]).toMatchObject({ homeName: "Динамо", awayName: "БАТЭ", homeScore: 2 });
    expect(page.cells[U1]![M1]).toEqual({
      homeScore: 2,
      awayScore: 1,
      result: "exact",
      points: 3,
    });
    expect(page.rows).toHaveLength(1);
  });

  it("falls back to the whole season for an unknown tour number", async () => {
    const { db } = fakeDb(seasonTables());
    const page = await getRatingPage(db, { tour: 99 });
    expect(page.tour).toBeNull();
    expect(page.rows).toHaveLength(2);
  });

  it("shows final places for a closed season", async () => {
    const { db } = fakeDb({
      ...seasonTables(),
      season_leaderboard: { data: [entry(U1, "Борис", { current_rank: 2, final_rank: 1 })] },
    });
    const page = await getRatingPage(db, { season: "old" });
    expect(page.season?.status).toBe("closed");
    expect(page.rows[0]).toMatchObject({ place: 1, final: true });
  });

  it("survives an empty catalogue and a tournament without seasons", async () => {
    const empty = fakeDb({ tournaments: { data: [] }, seasons: { data: [] } });
    expect((await getRatingPage(empty.db, {})).tournament).toBeNull();

    const noSeasons = fakeDb({ ...catalogue(), seasons: { data: [] } });
    const page = await getRatingPage(noSeasons.db, {});
    expect(page).toMatchObject({ season: null, rows: [] });
  });
});

describe("getProfileStats", () => {
  const row = (over: Record<string, unknown>) => ({
    season_id: SEASON,
    predictions_count: 10,
    wins_count: 6,
    losses_count: 3,
    points: 14,
    win_rate: 66.7,
    current_rank: 4,
    final_rank: null,
    seasons: {
      name: "2026",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      tournaments: { name: "Высшая лига" },
    },
    ...over,
  });

  it("returns a row per season, newest first, with the current place", async () => {
    const { db } = fakeDb({
      season_leaderboard: {
        data: [
          row({
            season_id: "old",
            seasons: {
              name: "2025",
              status: "active",
              created_at: "2025-01-01T00:00:00Z",
              tournaments: { name: "Кубок" },
            },
          }),
          row({}),
        ],
      },
    });
    const stats = await getProfileStats(db, U1);
    expect(stats.map((s) => s.seasonName)).toEqual(["2026", "2025"]);
    expect(stats[0]).toEqual({
      seasonId: SEASON,
      tournamentName: "Высшая лига",
      seasonName: "2026",
      predictionsCount: 10,
      winsCount: 6,
      lossesCount: 3,
      points: 14,
      winRate: 66.7,
      place: 4,
      final: false,
    });
  });

  it("uses the final place of a closed season and marks it", async () => {
    const { db } = fakeDb({
      season_leaderboard: {
        data: [
          row({
            final_rank: 2,
            seasons: {
              name: "2025",
              status: "closed",
              created_at: "2025-01-01T00:00:00Z",
              tournaments: { name: "Кубок" },
            },
          }),
        ],
      },
    });
    expect((await getProfileStats(db, U1))[0]).toMatchObject({ place: 2, final: true });
  });

  it("returns nothing for a participant without predictions", async () => {
    const { db } = fakeDb({ season_leaderboard: { data: [] } });
    expect(await getProfileStats(db, U1)).toEqual([]);
  });
});
