// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fakeDb } from "./fake-db";

vi.mock("@/lib/env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
}));

const { getStandingsPage } = await import("./standings");

const TOURNAMENT = "22222222-2222-4222-8222-222222222222";
const SEASON = "11111111-1111-4111-8111-111111111111";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const match = (over: Record<string, unknown>) => ({
  home_club_id: A,
  away_club_id: B,
  home_score: 1,
  away_score: 0,
  status: "finished",
  kickoff_at: "2026-10-20T16:00:00.000Z",
  updated_at: "2026-10-20T20:00:00.000Z",
  ...over,
});

function db(matches: unknown[]) {
  return fakeDb({
    tournaments: { data: [{ id: TOURNAMENT, slug: "liga", name: "Высшая лига" }] },
    seasons: {
      data: [
        {
          id: SEASON,
          name: "2026",
          status: "active",
          tournament_id: TOURNAMENT,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    },
    season_clubs: {
      data: [
        { clubs: { id: A, name: "Аня", logo_path: null } },
        { clubs: { id: B, name: "Борис", logo_path: null } },
      ],
    },
    tours: { data: [{ id: "tour1" }] },
    matches: { data: matches },
  }).db;
}

describe("getStandingsPage", () => {
  it("says when the latest counted result was entered", async () => {
    const page = await getStandingsPage(
      db([
        match({ updated_at: "2026-10-20T20:00:00.000Z" }),
        match({ updated_at: "2026-10-27T08:14:29.948256+00:00" }),
        // Not played yet: its edits do not make the table newer.
        match({
          status: "scheduled",
          home_score: null,
          away_score: null,
          updated_at: "2026-10-29T10:00:00Z",
        }),
      ]),
      {},
    );
    expect(page.counted).toBe(2);
    expect(page.total).toBe(3);
    expect(page.updatedAt).toBe("2026-10-27T08:14:29.948Z");
  });

  it("has no update time while nothing is counted", async () => {
    const page = await getStandingsPage(
      db([match({ status: "scheduled", home_score: null, away_score: null })]),
      {},
    );
    expect(page.counted).toBe(0);
    expect(page.updatedAt).toBeNull();
  });
});
