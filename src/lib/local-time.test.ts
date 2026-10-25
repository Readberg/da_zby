import { describe, expect, it } from "vitest";
import { formatDateTime, localInputToUtcIso, utcIsoToLocalInput } from "./local-time";

describe("localInputToUtcIso", () => {
  it("treats the input as UTC+3 by default", () => {
    expect(localInputToUtcIso("2026-10-25T18:30")).toBe("2026-10-25T15:30:00.000Z");
  });

  it("uses the given offset, also a negative or fractional one", () => {
    expect(localInputToUtcIso("2026-10-25T18:30", 0)).toBe("2026-10-25T18:30:00.000Z");
    expect(localInputToUtcIso("2026-10-25T18:30", -300)).toBe("2026-10-25T23:30:00.000Z");
    expect(localInputToUtcIso("2026-10-25T18:30", 345)).toBe("2026-10-25T12:45:00.000Z");
  });

  it("crosses midnight correctly", () => {
    expect(localInputToUtcIso("2026-10-26T01:00")).toBe("2026-10-25T22:00:00.000Z");
  });

  it.each(["", "2026-10-25", "25.10.2026 18:30", "2026-02-31T10:00", "not a date"])(
    "rejects %j",
    (value) => {
      expect(localInputToUtcIso(value)).toBeNull();
    },
  );
});

describe("utcIsoToLocalInput", () => {
  it("is the inverse of localInputToUtcIso", () => {
    for (const offset of [180, 0, -300, 345]) {
      const iso = localInputToUtcIso("2026-10-25T18:30", offset)!;
      expect(utcIsoToLocalInput(iso, offset)).toBe("2026-10-25T18:30");
    }
  });

  it("returns an empty string for nothing or garbage", () => {
    expect(utcIsoToLocalInput(null)).toBe("");
    expect(utcIsoToLocalInput("garbage")).toBe("");
  });
});

describe("formatDateTime", () => {
  it("formats in the offset of the viewer", () => {
    expect(formatDateTime("2026-10-25T15:30:00.000Z")).toBe("25 октября в 18:30");
    expect(formatDateTime("2026-10-25T15:30:00.000Z", 0)).toBe("25 октября в 15:30");
  });
});
