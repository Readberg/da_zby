// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
}));

const { getPublicProfile } = await import("./public-profiles");

function fakeDb(data: Record<string, unknown> | null, error: unknown = null) {
  const calls = { select: "", eq: [] as [string, unknown][] };
  const builder = {
    select: (columns: string) => {
      calls.select = columns;
      return builder;
    },
    eq: (column: string, value: unknown) => {
      calls.eq.push([column, value]);
      return builder;
    },
    maybeSingle: async () => ({ data, error }),
  };
  return { db: { from: () => builder } as never, calls };
}

const row = {
  id: "u1",
  nickname: "Readberg",
  full_name: "Роман",
  contact: "@readberg",
  about: "Люблю футбол",
  avatar_path: "u1/a.png",
  country_code: "BY",
  city: "Минск",
  created_at: "2026-10-24T10:00:00+00:00",
  last_login_at: "2026-10-25T09:00:00+00:00",
};

describe("getPublicProfile", () => {
  it("maps public fields only", async () => {
    const { db } = fakeDb(row);
    const profile = await getPublicProfile(db, "Readberg");
    expect(profile).toEqual({
      id: "u1",
      nickname: "Readberg",
      fullName: "Роман",
      contact: "@readberg",
      about: "Люблю футбол",
      avatarUrl: "https://example.supabase.co/storage/v1/object/public/avatars/u1/a.png",
      countryCode: "BY",
      city: "Минск",
      createdAt: "2026-10-24T10:00:00.000Z",
      lastLoginAt: "2026-10-25T09:00:00.000Z",
    });
    expect(Object.keys(profile!)).not.toContain("email");
    expect(Object.keys(profile!)).not.toContain("utcOffsetMinutes");
  });

  it("never selects private columns", async () => {
    const { db, calls } = fakeDb(row);
    await getPublicProfile(db, "Readberg");
    for (const forbidden of ["email", "role", "utc_offset_minutes", "*"]) {
      expect(calls.select).not.toContain(forbidden);
    }
    expect(calls.eq).toEqual([["nickname", "Readberg"]]);
  });

  it("returns null for an unknown nickname or one that is not chosen yet", async () => {
    expect(await getPublicProfile(fakeDb(null).db, "Нет")).toBeNull();
    expect(await getPublicProfile(fakeDb({ ...row, nickname: null }).db, "x")).toBeNull();
  });

  it("propagates database errors", async () => {
    await expect(getPublicProfile(fakeDb(null, new Error("db down")).db, "x")).rejects.toThrow(
      "db down",
    );
  });
});
