// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Fixture } from "@/lib/fixtures-plan";
import { fakeDb } from "./fake-db";
import { FixturesSourceError } from "./fixtures-source";
import { dueAt, reportMessage, syncResults, type SyncReport } from "./results-sync";

const SEASON = "11111111-1111-4111-8111-111111111111";
const TOUR = "44444444-4444-4444-8444-444444444444";
const MATCH = "55555555-5555-4555-8555-555555555555";
const A = "33333333-3333-4333-8333-333333333331";
const B = "33333333-3333-4333-8333-333333333332";

const KICKOFF = "2026-10-30T15:00:00.000Z";
// 15:00 + 110 minutes of play + 20 minutes of waiting = 17:10
const AFTER = new Date("2026-10-30T17:11:00Z");
const BEFORE = new Date("2026-10-30T17:09:00Z");

const fixture = (over: Partial<Fixture> = {}): Fixture => ({
  home: "Dinamo Minsk",
  away: "BATE Borisov",
  kickoffAt: KICKOFF,
  status: "finished",
  homeScore: 2,
  awayScore: 1,
  ...over,
});

const matchRow = (over: Record<string, unknown> = {}) => ({
  id: MATCH,
  tour_id: TOUR,
  home_club_id: A,
  away_club_id: B,
  kickoff_at: "2026-10-30T15:00:00.000Z",
  status: "scheduled",
  home_score: null,
  away_score: null,
  ...over,
});

const tables = (matches: unknown[] = [matchRow()]) =>
  ({
    seasons: { data: [{ id: SEASON, name: "2026", status: "active" }] },
    tours: {
      data: [{ id: TOUR, season_id: SEASON, number: 27, title: null, deadline_override: null }],
    },
    matches: { data: matches, writeData: [matchRow({ status: "finished" })] },
    season_clubs: { data: [{ club_id: A }, { club_id: B }] },
    clubs: {
      data: [
        { id: A, name: "Динамо Минск" },
        { id: B, name: "БАТЭ" },
      ],
    },
  }) as Parameters<typeof fakeDb>[0];

const source = (fixtures: Fixture[]) => ({ fetchRound: vi.fn(async () => fixtures) });

describe("dueAt", () => {
  it("is the end of the match plus 20 minutes", () => {
    expect(dueAt(KICKOFF).toISOString()).toBe("2026-10-30T17:10:00.000Z");
  });
});

describe("syncResults", () => {
  it("asks only for matches whose end and 20 minutes are past, and not older than 3 days", async () => {
    const { db, calls } = fakeDb(tables([]));
    await syncResults(db, source([]), AFTER);
    const rows = calls.matches!;
    expect(rows.find((c) => c.method === "eq")!.args).toEqual(["status", "scheduled"]);
    const latest = rows.find((c) => c.method === "lte")!.args[1] as string;
    const earliest = rows.find((c) => c.method === "gte")!.args[1] as string;
    expect(latest).toBe("2026-10-30T15:01:00.000Z");
    expect(earliest).toBe("2026-10-27T17:11:00.000Z");
  });

  it("does not ask the source when no match is due", async () => {
    const deps = source([fixture()]);
    const { db } = fakeDb(tables([]));
    const report = await syncResults(db, deps, BEFORE);
    expect(report).toEqual({ due: 0, toursAsked: 0, updated: [], waiting: 0, attention: [] });
    expect(deps.fetchRound).not.toHaveBeenCalled();
  });

  it("enters the result of a finished match and nothing else of it", async () => {
    const deps = source([fixture({ kickoffAt: "2026-10-30T16:00:00.000Z" })]);
    const { db, payload } = fakeDb(tables());
    const report = await syncResults(db, deps, AFTER);

    expect(deps.fetchRound).toHaveBeenCalledTimes(1);
    expect(report.updated).toEqual([
      { matchId: MATCH, home: "Динамо Минск", away: "БАТЭ", homeScore: 2, awayScore: 1 },
    ]);
    const written = payload("matches", "update") as Record<string, unknown>;
    expect(written).toMatchObject({ status: "finished", home_score: 2, away_score: 1 });
    // The source's different kick-off time is the admin's business: ours is written back as it was.
    expect(written.kickoff_at).toBe(KICKOFF);
  });

  it("waits while the source says the match is still on", async () => {
    const deps = source([fixture({ status: "live", homeScore: 1, awayScore: 0 })]);
    const { db, calls } = fakeDb(tables());
    const report = await syncResults(db, deps, AFTER);
    expect(report.updated).toEqual([]);
    expect(report.waiting).toBe(1);
    expect(calls.matches!.some((c) => c.method === "update")).toBe(false);
  });

  it("flags a match that is over but that the source does not list", async () => {
    const { db } = fakeDb(tables());
    const report = await syncResults(db, source([]), AFTER);
    expect(report.updated).toEqual([]);
    expect(report.attention[0]).toMatch(/не найден в источнике/);
  });

  it("reports a source that is down and does not throw", async () => {
    const deps = {
      fetchRound: vi.fn(async () => {
        throw new FixturesSourceError("The source did not answer");
      }),
    };
    const { db, calls } = fakeDb(tables());
    const report = await syncResults(db, deps, AFTER);
    expect(report.updated).toEqual([]);
    expect(report.attention[0]).toMatch(/Источник результатов не ответил/);
    expect(calls.matches!.some((c) => c.method === "update")).toBe(false);
  });

  it("does not write a finished match without a whole score, and says so", async () => {
    const deps = source([fixture({ homeScore: null, awayScore: null })]);
    const { db, calls } = fakeDb(tables());
    const report = await syncResults(db, deps, AFTER);
    expect(report.updated).toEqual([]);
    expect(report.attention[0]).toMatch(/нет счёта завершённого матча/);
    expect(calls.matches!.some((c) => c.method === "update")).toBe(false);
  });

  it("flags a club that the catalogue does not know", async () => {
    const deps = source([fixture({ home: "Unknown FC" })]);
    const { db } = fakeDb(tables());
    const report = await syncResults(db, deps, AFTER);
    expect(report.updated).toEqual([]);
    expect(report.attention.join(" ")).toMatch(/не найден/);
  });
});

describe("reportMessage", () => {
  it("lists the entered scores and tells where to correct a wrong one", () => {
    const report: SyncReport = {
      due: 2,
      toursAsked: 1,
      updated: [{ matchId: MATCH, home: "Арсенал", away: "БАТЭ", homeScore: 0, awayScore: 3 }],
      waiting: 1,
      attention: ["Ислочь — Славия: источник завершил матч без понятного счёта"],
    };
    const text = reportMessage(report);
    expect(text).toContain("Результаты внесены автоматически (1):");
    expect(text).toContain("Арсенал 0:3 БАТЭ");
    expect(text).toContain("Ждём результатов: 1.");
    expect(text).toContain("Ислочь — Славия");
    expect(text).toContain("поправьте его в админке тура");
  });
});
