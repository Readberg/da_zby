import { describe, expect, it } from "vitest";
import { planImport, type ExistingMatch, type Fixture } from "./fixtures-plan";

const clubs = [
  { id: "dm", name: "Динамо Минск" },
  { id: "bt", name: "БАТЭ" },
  { id: "mn", name: "Минск" },
  { id: "ou", name: "Витебск" },
];
const roster = new Set(["dm", "bt", "mn"]);

const fixture = (over: Partial<Fixture> = {}): Fixture => ({
  home: "Dinamo Minsk",
  away: "BATE Borisov",
  kickoffAt: "2026-10-28T11:00:00.000Z",
  status: "scheduled",
  homeScore: null,
  awayScore: null,
  ...over,
});

const match = (over: Partial<ExistingMatch> = {}): ExistingMatch => ({
  id: "m1",
  homeClubId: "dm",
  awayClubId: "bt",
  kickoffAt: "2026-10-28T11:00:00.000Z",
  status: "scheduled",
  homeScore: null,
  awayScore: null,
  ...over,
});

const plan = (fixtures: Fixture[], matches: ExistingMatch[] = []) =>
  planImport({ fixtures, clubs, roster, matches });

describe("planImport", () => {
  it("creates a match that the tour does not have", () => {
    const [row] = plan([fixture()]).rows;
    expect(row).toMatchObject({ action: "create", homeName: "Динамо Минск", awayName: "БАТЭ" });
    expect(row?.next).toMatchObject({ status: "scheduled", kickoffAt: "2026-10-28T11:00:00.000Z" });
  });

  it("creates a played match with its score", () => {
    const [row] = plan([fixture({ status: "finished", homeScore: 2, awayScore: 1 })]).rows;
    expect(row?.action).toBe("create");
    expect(row?.next).toMatchObject({ status: "finished", homeScore: 2, awayScore: 1 });
  });

  it("changes nothing when the match is the same", () => {
    const [row] = plan([fixture()], [match()]).rows;
    expect(row).toMatchObject({ action: "same", matchId: "m1", next: null });
  });

  it("ignores a time difference below a minute", () => {
    const [row] = plan([fixture({ kickoffAt: "2026-10-28T11:00:30.000Z" })], [match()]).rows;
    expect(row?.action).toBe("same");
  });

  it("moves the kick-off time", () => {
    const [row] = plan([fixture({ kickoffAt: "2026-10-29T15:00:00.000Z" })], [match()]).rows;
    expect(row?.action).toBe("update");
    expect(row?.next?.kickoffAt).toBe("2026-10-29T15:00:00.000Z");
    expect(row?.current?.kickoffAt).toBe("2026-10-28T11:00:00.000Z");
  });

  it("enters a result for a match that was still scheduled", () => {
    const [row] = plan(
      [fixture({ status: "finished", homeScore: 0, awayScore: 3 })],
      [match()],
    ).rows;
    expect(row?.action).toBe("update");
    expect(row?.next).toMatchObject({ status: "finished", homeScore: 0, awayScore: 3 });
  });

  it("keeps the time of a finished match and only corrects a different score", () => {
    const [row] = plan(
      [
        fixture({
          status: "finished",
          homeScore: 1,
          awayScore: 1,
          kickoffAt: "2026-10-30T09:00:00.000Z",
        }),
      ],
      [match({ status: "finished", homeScore: 2, awayScore: 1 })],
    ).rows;
    expect(row?.action).toBe("update");
    expect(row?.next?.kickoffAt).toBe("2026-10-28T11:00:00.000Z");
    expect(row?.next).toMatchObject({ homeScore: 1, awayScore: 1 });
  });

  it("marks a postponed match and brings it back when it is scheduled again", () => {
    const [moved] = plan([fixture({ status: "postponed" })], [match()]).rows;
    expect(moved?.next).toMatchObject({ status: "postponed", homeScore: null });
    const [back] = plan(
      [fixture({ kickoffAt: "2026-11-02T11:00:00.000Z" })],
      [match({ status: "postponed" })],
    ).rows;
    expect(back?.action).toBe("update");
    expect(back?.next).toMatchObject({
      status: "scheduled",
      kickoffAt: "2026-11-02T11:00:00.000Z",
    });
  });

  it("never reopens a match that is finished with us", () => {
    const [row] = plan(
      [fixture()],
      [match({ status: "finished", homeScore: 1, awayScore: 0 })],
    ).rows;
    expect(row?.action).toBe("blocked");
    expect(row?.notes[0]).toMatch(/завершён/);
  });

  it("blocks an unknown club, a club outside the roster and a finished match without a score", () => {
    const unknown = plan([fixture({ home: "Dynamo Brest" })]).rows[0];
    expect(unknown?.action).toBe("blocked");
    expect(unknown?.notes.join()).toContain("«Dynamo Brest» не найден");

    const outside = plan([fixture({ home: "Vitebsk" })]).rows[0];
    expect(outside?.action).toBe("blocked");
    expect(outside?.notes.join()).toContain("не входит в состав сезона");

    const noScore = plan([fixture({ status: "finished" })]).rows[0];
    expect(noScore?.notes.join()).toContain("нет счёта");
  });

  it("does not apply a match that is being played", () => {
    expect(plan([fixture({ status: "live" })]).rows[0]?.action).toBe("blocked");
  });

  it("lists the tour's matches that the source does not have", () => {
    const result = plan(
      [fixture()],
      [match(), match({ id: "m2", homeClubId: "mn", awayClubId: "dm" })],
    );
    expect(result.extra).toEqual([{ matchId: "m2", homeName: "Минск", awayName: "Динамо Минск" }]);
  });
});
