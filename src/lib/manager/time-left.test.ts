import { describe, expect, it } from "vitest";
import { formatTimeLeft, lineupDeadline } from "./time-left";

describe("formatTimeLeft", () => {
  it("shows hours, minutes and seconds", () => {
    expect(formatTimeLeft(3_723_000)).toBe("01:02:03");
    expect(formatTimeLeft(59_000)).toBe("00:00:59");
  });

  it("puts the days in front from 24 hours on", () => {
    expect(formatTimeLeft(86_400_000 + 3_723_000, "д")).toBe("1 д 01:02:03");
    expect(formatTimeLeft(5 * 86_400_000, "д")).toBe("5 д 00:00:00");
  });

  it("never goes below zero", () => {
    expect(formatTimeLeft(-5000)).toBe("00:00:00");
    expect(formatTimeLeft(0)).toBe("00:00:00");
  });
});

describe("lineupDeadline", () => {
  it("is five minutes before the kickoff", () => {
    expect(lineupDeadline("2026-11-20T07:00:00.000Z").toISOString()).toBe(
      "2026-11-20T06:55:00.000Z",
    );
  });
});
