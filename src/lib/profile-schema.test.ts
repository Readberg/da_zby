import { describe, expect, it } from "vitest";
import { formatUtcOffset, nicknameSchema, profilePatchSchema } from "./profile-schema";

describe("nicknameSchema (D-012)", () => {
  it.each(["abc", "Readberg", "Баранки_07", "A1_", "a".repeat(20)])("accepts %s", (nick) => {
    expect(nicknameSchema.safeParse(nick).success).toBe(true);
  });

  it.each(["ab", "a".repeat(21), "with space", "dash-ed", "emoji😀", "точка.", ""])(
    "rejects %j",
    (nick) => {
      expect(nicknameSchema.safeParse(nick).success).toBe(false);
    },
  );

  it("trims surrounding spaces", () => {
    expect(nicknameSchema.parse("  Readberg ")).toBe("Readberg");
  });
});

describe("profilePatchSchema", () => {
  it("accepts a partial update and normalises empty text to null", () => {
    expect(profilePatchSchema.parse({ about: "  ", city: " Минск " })).toEqual({
      about: null,
      city: "Минск",
    });
  });

  it("requires at least one field", () => {
    expect(profilePatchSchema.safeParse({}).success).toBe(false);
  });

  it("limits text lengths from the data model", () => {
    expect(profilePatchSchema.safeParse({ about: "x".repeat(1001) }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ about: "x".repeat(1000) }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ fullName: "x".repeat(101) }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ contact: "x".repeat(201) }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ city: "x".repeat(101) }).success).toBe(false);
  });

  it("accepts only listed countries or null", () => {
    expect(profilePatchSchema.safeParse({ countryCode: "BY" }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ countryCode: null }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ countryCode: "ZZ" }).success).toBe(false);
  });

  it("keeps the UTC offset in range and whole minutes", () => {
    expect(profilePatchSchema.safeParse({ utcOffsetMinutes: 180 }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ utcOffsetMinutes: -721 }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ utcOffsetMinutes: 841 }).success).toBe(false);
    expect(profilePatchSchema.safeParse({ utcOffsetMinutes: 90.5 }).success).toBe(false);
  });

  it("rejects unknown fields silently by dropping them, never writing role", () => {
    const parsed = profilePatchSchema.parse({ city: "Минск", role: "admin" } as never);
    expect(parsed).toEqual({ city: "Минск" });
  });
});

describe("formatUtcOffset", () => {
  it.each([
    [180, "UTC+3"],
    [0, "UTC+0"],
    [-300, "UTC−5"],
    [345, "UTC+5:45"],
  ])("%i → %s", (minutes, text) => {
    expect(formatUtcOffset(minutes)).toBe(text);
  });
});
