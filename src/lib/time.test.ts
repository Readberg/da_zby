import { describe, expect, it } from "vitest";
import { formatDate } from "./time";

describe("formatDate", () => {
  it("formats in UTC+3 by default", () => {
    expect(formatDate("2026-10-23T12:16:22Z")).toBe("23 октября 2026");
  });

  it("moves late-UTC instants to the next day in Minsk", () => {
    expect(formatDate("2026-10-23T22:30:00Z")).toBe("24 октября 2026");
  });

  it("supports other offsets", () => {
    expect(formatDate("2026-01-01T01:00:00Z", -120)).toBe("31 декабря 2025");
  });
});
