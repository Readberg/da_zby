// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { FixturesSourceError, fetchRound, mapStatus, parseRound } from "./fixtures-source";

// Shape of a real answer of eventsround.php (fields we do not read are left out).
const event = (over: Record<string, unknown> = {}) => ({
  strHomeTeam: "Minsk",
  strAwayTeam: "Arsenal Dzerzhinsk",
  strStatus: "FT",
  strTimestamp: "2026-03-20T14:00:00",
  dateEvent: "2026-03-20",
  strTime: "14:00:00",
  intHomeScore: "1",
  intAwayScore: "1",
  intRound: "1",
  ...over,
});

describe("mapStatus", () => {
  it("maps the words of the source to ours", () => {
    expect(mapStatus("FT")).toBe("finished");
    expect(mapStatus("AET")).toBe("finished");
    expect(mapStatus("NS")).toBe("scheduled");
    expect(mapStatus(null)).toBe("scheduled");
    expect(mapStatus("PST")).toBe("postponed");
    expect(mapStatus("CANC")).toBe("cancelled");
  });

  it("treats anything else as a match in progress", () => {
    expect(mapStatus("1H")).toBe("live");
    expect(mapStatus("HT")).toBe("live");
  });
});

describe("parseRound", () => {
  it("reads teams, UTC kick-off, status and score", () => {
    const [match] = parseRound({ events: [event()] });
    expect(match).toEqual({
      home: "Minsk",
      away: "Arsenal Dzerzhinsk",
      kickoffAt: "2026-03-20T14:00:00.000Z",
      status: "finished",
      homeScore: 1,
      awayScore: 1,
    });
  });

  it("has no score for a match that has not been played", () => {
    const [match] = parseRound({
      events: [event({ strStatus: "NS", intHomeScore: null, intAwayScore: null })],
    });
    expect(match).toMatchObject({ status: "scheduled", homeScore: null, awayScore: null });
  });

  it("builds the instant from the date and time when the timestamp is missing", () => {
    const [match] = parseRound({ events: [event({ strTimestamp: null })] });
    expect(match?.kickoffAt).toBe("2026-03-20T14:00:00.000Z");
  });

  it("skips an event without a usable time and sorts the rest by time", () => {
    const fixtures = parseRound({
      events: [
        event({ strHomeTeam: "B", strTimestamp: "2026-03-21T10:00:00" }),
        event({ strHomeTeam: "X", strTimestamp: null, dateEvent: null }),
        event({ strHomeTeam: "A", strTimestamp: "2026-03-20T10:00:00" }),
      ],
    });
    expect(fixtures.map((f) => f.home)).toEqual(["A", "B"]);
  });

  it("copes with a round that has no events and refuses a strange answer", () => {
    expect(parseRound({ events: null })).toEqual([]);
    expect(parseRound({})).toEqual([]);
    expect(() => parseRound({ events: [{ strHomeTeam: 5 }] })).toThrow(FixturesSourceError);
    expect(() => parseRound("nope")).toThrow(FixturesSourceError);
  });
});

describe("fetchRound", () => {
  const ok = (body: unknown) =>
    vi.fn(
      async () => new Response(JSON.stringify(body), { status: 200 }),
    ) as unknown as typeof fetch;

  it("asks for the round of the league with the key and returns the matches", async () => {
    const fetcher = ok({ events: [event()] });
    const fixtures = await fetchRound({ season: "2026", round: 7, apiKey: "k1" }, fetcher);
    expect(fixtures).toHaveLength(1);
    const url = String(vi.mocked(fetcher).mock.calls[0]?.[0]);
    expect(url).toBe(
      "https://www.thesportsdb.com/api/v1/json/k1/eventsround.php?id=4622&r=7&s=2026",
    );
  });

  it("uses the free key when none is given", async () => {
    const fetcher = ok({ events: [] });
    await fetchRound({ season: "2026", round: 1 }, fetcher);
    expect(String(vi.mocked(fetcher).mock.calls[0]?.[0])).toContain("/json/123/");
  });

  it("explains a network failure, an error status and an HTML answer", async () => {
    await expect(
      fetchRound(
        { season: "2026", round: 1 },
        vi.fn(async () => Promise.reject(new Error("down"))) as never,
      ),
    ).rejects.toThrow(/did not answer/);
    await expect(
      fetchRound(
        { season: "2026", round: 1 },
        vi.fn(async () => new Response("x", { status: 503 })) as never,
      ),
    ).rejects.toThrow(/503/);
    await expect(
      fetchRound(
        { season: "2026", round: 1 },
        vi.fn(async () => new Response("<!doctype html>", { status: 200 })) as never,
      ),
    ).rejects.toThrow(/too many requests/);
  });
});
