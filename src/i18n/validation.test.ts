import { describe, expect, it } from "vitest";
import { predictionsBodySchema } from "@/lib/predictions";
import { profilePatchSchema } from "@/lib/profile-schema";
import { hasEnglish, localizeMessage } from "./validation";

function messages(
  schema: {
    safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } };
  },
  input: unknown,
) {
  const result = schema.safeParse(input);
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.message);
}

describe("localizeMessage", () => {
  it("keeps Russian as it is and translates for English", () => {
    expect(localizeMessage("Этот ник уже занят", "ru")).toBe("Этот ник уже занят");
    expect(localizeMessage("Этот ник уже занят", "en")).toBe("This nickname is already taken");
    expect(localizeMessage("Не длиннее 100 символов", "en")).toBe("No longer than 100 characters");
  });

  it("shows an unknown message unchanged", () => {
    expect(localizeMessage("Something else", "en")).toBe("Something else");
  });
});

describe("every message of the shared schemas has an English text", () => {
  it("profile", () => {
    const all = [
      ...messages(profilePatchSchema, { nickname: "!" }),
      ...messages(profilePatchSchema, { countryCode: "ZZ" }),
      ...messages(profilePatchSchema, { avatarPath: "x" }),
      ...messages(profilePatchSchema, { utcOffsetMinutes: 9999 }),
      ...messages(profilePatchSchema, { utcOffsetMinutes: -9999 }),
      ...messages(profilePatchSchema, {
        fullName: "x".repeat(101),
        contact: "x".repeat(201),
        about: "x".repeat(1001),
        city: "x".repeat(101),
      }),
      ...messages(profilePatchSchema, {}),
    ];
    expect(all.length).toBeGreaterThan(6);
    expect(all.filter((message) => !hasEnglish(message))).toEqual([]);
  });

  it("predictions", () => {
    const all = [
      ...messages(predictionsBodySchema, { tourId: "x", items: [] }),
      ...messages(predictionsBodySchema, {
        tourId: "x",
        items: [{ matchId: "y", homeScore: 1.5, awayScore: 100 }],
      }),
      ...messages(predictionsBodySchema, {
        tourId: "x",
        items: [{ matchId: "y", homeScore: -1, awayScore: 0 }],
      }),
      ...messages(predictionsBodySchema, {
        tourId: "x",
        items: Array(51).fill({ matchId: "y", homeScore: 0, awayScore: 0 }),
      }),
    ];
    expect(all.length).toBeGreaterThan(5);
    expect(all.filter((message) => !hasEnglish(message))).toEqual([]);
  });
});
