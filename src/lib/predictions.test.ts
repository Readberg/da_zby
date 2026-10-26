import { describe, expect, it } from "vitest";
import {
  hiddenUntil,
  isMatchOpen,
  isTourOpen,
  pickCurrentTour,
  predictionsBodySchema,
  tourDeadline,
} from "./predictions";

const ID = "11111111-1111-4111-8111-111111111111";
const at = (iso: string) => new Date(iso);

describe("tourDeadline", () => {
  it("is 10 minutes before the first match", () => {
    const deadline = tourDeadline(null, [
      { kickoffAt: "2026-10-30T16:00:00Z", status: "scheduled" },
      { kickoffAt: "2026-10-30T15:00:00Z", status: "scheduled" },
    ]);
    expect(deadline?.toISOString()).toBe("2026-10-30T14:50:00.000Z");
  });

  it("ignores cancelled matches but counts postponed ones", () => {
    const deadline = tourDeadline(null, [
      { kickoffAt: "2026-10-30T12:00:00Z", status: "cancelled" },
      { kickoffAt: "2026-10-30T15:00:00Z", status: "postponed" },
    ]);
    expect(deadline?.toISOString()).toBe("2026-10-30T14:50:00.000Z");
  });

  it("prefers the pinned deadline and is null without matches", () => {
    expect(
      tourDeadline("2026-10-29T10:00:00Z", [
        { kickoffAt: "2026-10-30T15:00:00Z", status: "scheduled" },
      ])?.toISOString(),
    ).toBe("2026-10-29T10:00:00.000Z");
    expect(tourDeadline(null, [])).toBeNull();
    expect(
      tourDeadline(null, [{ kickoffAt: "2026-10-30T15:00:00Z", status: "cancelled" }]),
    ).toBeNull();
  });
});

describe("isTourOpen / isMatchOpen", () => {
  const deadline = at("2026-10-30T14:50:00Z");

  it("is open only for an active season before the deadline", () => {
    expect(isTourOpen("active", deadline, at("2026-10-30T14:49:59Z"))).toBe(true);
    expect(isTourOpen("active", deadline, at("2026-10-30T14:50:00Z"))).toBe(false);
    expect(isTourOpen("closed", deadline, at("2026-10-01T00:00:00Z"))).toBe(false);
    expect(isTourOpen("active", null, at("2026-10-01T00:00:00Z"))).toBe(false);
  });

  it("accepts predictions for scheduled and postponed matches only", () => {
    expect(isMatchOpen("scheduled")).toBe(true);
    expect(isMatchOpen("postponed")).toBe(true);
    expect(isMatchOpen("finished")).toBe(false);
    expect(isMatchOpen("cancelled")).toBe(false);
  });
});

describe("pickCurrentTour", () => {
  const tour = (number: number, deadline: string | null) => ({
    number,
    deadline: deadline ? at(deadline) : null,
  });
  const now = at("2026-10-30T00:00:00Z");

  it("takes the first tour whose deadline is still ahead", () => {
    const tours = [
      tour(3, "2026-11-10T10:00:00Z"),
      tour(1, "2026-10-01T10:00:00Z"),
      tour(2, "2026-10-31T10:00:00Z"),
    ];
    expect(pickCurrentTour(tours, now)?.number).toBe(2);
  });

  it("falls back to the last tour that has matches when all deadlines passed", () => {
    const tours = [tour(1, "2026-10-01T10:00:00Z"), tour(2, "2026-10-10T10:00:00Z"), tour(3, null)];
    expect(pickCurrentTour(tours, now)?.number).toBe(2);
  });

  it("skips empty tours when a later one is upcoming, and handles nothing", () => {
    expect(pickCurrentTour([tour(1, null), tour(2, "2026-11-01T10:00:00Z")], now)?.number).toBe(2);
    expect(pickCurrentTour([tour(1, null)], now)?.number).toBe(1);
    expect(pickCurrentTour([], now)).toBeNull();
  });
});

describe("predictionsBodySchema", () => {
  const item = { matchId: ID, homeScore: 2, awayScore: 1 };

  it("accepts scores from 0 to 99", () => {
    expect(predictionsBodySchema.safeParse({ tourId: ID, items: [item] }).success).toBe(true);
    expect(
      predictionsBodySchema.safeParse({
        tourId: ID,
        items: [{ ...item, homeScore: 0, awayScore: 99 }],
      }).success,
    ).toBe(true);
  });

  it.each([-1, 100, 1.5, "2"])("rejects the score %j", (homeScore) => {
    expect(
      predictionsBodySchema.safeParse({ tourId: ID, items: [{ ...item, homeScore }] }).success,
    ).toBe(false);
  });

  it("needs at least one item and valid ids", () => {
    expect(predictionsBodySchema.safeParse({ tourId: ID, items: [] }).success).toBe(false);
    expect(predictionsBodySchema.safeParse({ tourId: "x", items: [item] }).success).toBe(false);
  });
});

describe("hiddenUntil", () => {
  const now = new Date("2026-10-26T12:00:00Z");

  it("gives the deadline while it is ahead", () => {
    expect(hiddenUntil("2026-10-26T12:00:01Z", now)).toBe("2026-10-26T12:00:01Z");
  });

  it("gives nothing once the deadline has come or when there is none", () => {
    expect(hiddenUntil("2026-10-26T12:00:00Z", now)).toBeNull();
    expect(hiddenUntil("2026-10-25T12:00:00Z", now)).toBeNull();
    expect(hiddenUntil(null, now)).toBeNull();
  });
});
