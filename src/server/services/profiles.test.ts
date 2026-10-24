// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api/v1/problem";

vi.mock("@/lib/env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
}));

const { checkNickname, getOwnProfile, updateOwnProfile } = await import("./profiles");

const row = (over: Record<string, unknown> = {}) => ({
  id: "u1",
  nickname: null,
  full_name: null,
  contact: null,
  about: null,
  avatar_path: null,
  country_code: null,
  city: null,
  utc_offset_minutes: 180,
  role: "user",
  created_at: "2026-10-24T10:00:00+00:00",
  last_login_at: null,
  updated_at: "2026-10-24T10:00:00+00:00",
  ...over,
});

/** Minimal chainable stand-in for the supabase-js query builder. */
function fakeDb(opts: {
  current?: ReturnType<typeof row> | null;
  updated?: ReturnType<typeof row>;
  updateError?: { code: string; message: string };
  taken?: boolean;
}) {
  const calls: { update?: unknown; eq: [string, unknown][] } = { eq: [] };
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      calls.eq.push([col, val]);
      return builder;
    },
    limit: async () => ({ data: opts.taken ? [{ id: "other" }] : [], error: null }),
    maybeSingle: async () => ({ data: opts.current ?? null, error: null }),
    update: (value: unknown) => {
      calls.update = value;
      return {
        eq: () => ({
          select: () => ({
            single: async () =>
              opts.updateError
                ? { data: null, error: opts.updateError }
                : { data: opts.updated ?? opts.current, error: null },
          }),
        }),
      };
    },
  };
  return { db: { from: () => builder } as never, calls };
}

const user = { id: "u1", email: "u@example.com" };

describe("getOwnProfile", () => {
  it("maps the row to the DTO and adds the auth e-mail", async () => {
    const { db } = fakeDb({
      current: row({ nickname: "Readberg", avatar_path: "u1/a.png", role: "admin" }),
    });
    const me = await getOwnProfile(db, user);
    expect(me).toMatchObject({
      id: "u1",
      nickname: "Readberg",
      role: "admin",
      email: "u@example.com",
      utcOffsetMinutes: 180,
      avatarUrl: "https://example.supabase.co/storage/v1/object/public/avatars/u1/a.png",
      createdAt: "2026-10-24T10:00:00.000Z",
    });
  });

  it("answers 404 when the profile row is missing", async () => {
    const { db } = fakeDb({ current: null });
    await expect(getOwnProfile(db, user)).rejects.toMatchObject({
      status: 404,
      code: "profile.not_found",
    });
  });
});

describe("updateOwnProfile", () => {
  it("writes only the provided columns, mapped to snake_case", async () => {
    const { db, calls } = fakeDb({
      current: row({ nickname: "Readberg" }),
      updated: row({ nickname: "Readberg", city: "Минск" }),
    });
    const me = await updateOwnProfile(db, user, { city: "Минск", utcOffsetMinutes: 120 });
    expect(calls.update).toEqual({ city: "Минск", utc_offset_minutes: 120 });
    expect(me.city).toBe("Минск");
  });

  it("sets the nickname the first time", async () => {
    const { db, calls } = fakeDb({ current: row(), updated: row({ nickname: "Новичок" }) });
    await updateOwnProfile(db, user, { nickname: "Новичок" });
    expect(calls.update).toEqual({ nickname: "Новичок" });
  });

  it("locks a chosen nickname", async () => {
    const { db } = fakeDb({ current: row({ nickname: "Readberg" }) });
    await expect(updateOwnProfile(db, user, { nickname: "Другой" })).rejects.toMatchObject({
      status: 409,
      code: "profile.nickname_locked",
    });
  });

  it("allows re-sending the same nickname (any case) as a no-op for that field", async () => {
    const { db, calls } = fakeDb({ current: row({ nickname: "Readberg" }) });
    const me = await updateOwnProfile(db, user, { nickname: "readberg" });
    expect(calls.update).toBeUndefined();
    expect(me.nickname).toBe("Readberg");
  });

  it("turns a unique violation into nickname_taken", async () => {
    const { db } = fakeDb({ current: row(), updateError: { code: "23505", message: "dup" } });
    const error = await updateOwnProfile(db, user, { nickname: "Занято" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "profile.nickname_taken" });
    expect(error.errors[0].field).toBe("nickname");
  });

  it("turns a check violation into 422", async () => {
    const { db } = fakeDb({
      current: row({ nickname: "Readberg" }),
      updateError: { code: "23514", message: "bad" },
    });
    await expect(updateOwnProfile(db, user, { about: "x" })).rejects.toMatchObject({ status: 422 });
  });
});

describe("updateOwnProfile — photo", () => {
  it("attaches a photo from the user's own folder", async () => {
    const { db, calls } = fakeDb({
      current: row({ nickname: "Readberg" }),
      updated: row({ nickname: "Readberg", avatar_path: "u1/a.png" }),
    });
    await updateOwnProfile(db, user, { avatarPath: "u1/a.png" });
    expect(calls.update).toEqual({ avatar_path: "u1/a.png" });
  });

  it("refuses a path in somebody else's folder", async () => {
    const { db, calls } = fakeDb({ current: row({ nickname: "Readberg" }) });
    await expect(updateOwnProfile(db, user, { avatarPath: "other/a.png" })).rejects.toMatchObject({
      status: 422,
    });
    expect(calls.update).toBeUndefined();
  });

  it("removes the photo with null", async () => {
    const { db, calls } = fakeDb({
      current: row({ nickname: "Readberg", avatar_path: "u1/a.png" }),
      updated: row({ nickname: "Readberg" }),
    });
    await updateOwnProfile(db, user, { avatarPath: null });
    expect(calls.update).toEqual({ avatar_path: null });
  });
});

describe("checkNickname", () => {
  it("rejects invalid nicknames without touching the database", async () => {
    const { db } = fakeDb({});
    expect(await checkNickname(db, "a b")).toEqual({ valid: false, available: false });
    expect(await checkNickname(db, "ab")).toEqual({ valid: false, available: false });
  });

  it("reports free and taken nicknames", async () => {
    expect(await checkNickname(fakeDb({ taken: false }).db, "Свободный")).toEqual({
      valid: true,
      available: true,
    });
    expect(await checkNickname(fakeDb({ taken: true }).db, "Занятый")).toEqual({
      valid: true,
      available: false,
    });
  });
});
