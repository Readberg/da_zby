// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import { getUserProfile, listUsers, setUserRole, updateUserProfile } from "./admin-users";
import { fakeDb } from "./fake-db";

vi.mock("@/lib/env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
}));

const row = (n: number, role = "user") => ({
  id: `00000000-0000-0000-0000-00000000000${n}`,
  nickname: `user${n}`,
  full_name: n === 1 ? "Роман" : null,
  role,
  created_at: "2026-10-24T10:00:00+00:00",
  last_login_at: n === 1 ? "2026-10-25T08:00:00+00:00" : null,
});

function listDb(result: { data: unknown[]; count: number; error?: unknown }) {
  const calls: Record<string, unknown[]> = {};
  const chain: Record<string, unknown> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls[name] = args;
      return chain;
    };
  for (const name of ["select", "order", "range", "or"]) chain[name] = record(name);
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ error: null, ...result }).then(resolve);
  return { db: { from: vi.fn(() => chain) } as never, calls };
}

describe("listUsers", () => {
  it("maps rows to DTOs and pages with range()", async () => {
    const { db, calls } = listDb({ data: [row(1, "admin"), row(2)], count: 7 });
    const result = await listUsers(db, { page: 2, pageSize: 5 });

    expect(calls.range).toEqual([5, 9]);
    expect(result.total).toBe(7);
    expect(result.items[0]).toEqual({
      id: row(1).id,
      nickname: "user1",
      fullName: "Роман",
      role: "admin",
      createdAt: "2026-10-24T10:00:00.000Z",
      lastLoginAt: "2026-10-25T08:00:00.000Z",
    });
    expect(result.items[1]).toMatchObject({ role: "user", fullName: null, lastLoginAt: null });
    expect(calls.or).toBeUndefined();
  });

  it("searches nickname and full name, stripping characters that change the filter", async () => {
    const { db, calls } = listDb({ data: [], count: 0 });
    await listUsers(db, { search: "ро%ма,н(1)*", page: 1, pageSize: 50 });
    expect(calls.or).toEqual(["nickname.ilike.%ро ма н 1%,full_name.ilike.%ро ма н 1%"]);
  });

  it("does not filter when the search has nothing but special characters", async () => {
    const { db, calls } = listDb({ data: [], count: 0 });
    await listUsers(db, { search: "%%,,", page: 1, pageSize: 50 });
    expect(calls.or).toBeUndefined();
  });
});

function roleDb(options: {
  exists?: boolean;
  rpcError?: { message: string; code?: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue({ error: options.rpcError ?? null });
  const lookup = {
    select: () => lookup,
    eq: () => lookup,
    maybeSingle: async () => ({ data: options.exists === false ? null : { id: "u" }, error: null }),
  };
  return { db: { from: () => lookup, rpc } as never, rpc };
}

const target = { userId: "00000000-0000-0000-0000-000000000002", role: "admin" as const };

describe("setUserRole", () => {
  it("calls the database function and returns the new role", async () => {
    const { db, rpc } = roleDb({});
    await expect(setUserRole(db, target)).resolves.toEqual(target);
    expect(rpc).toHaveBeenCalledWith("set_user_role", {
      target: target.userId,
      new_role: "admin",
    });
  });

  it("answers 404 for an unknown user without calling the function", async () => {
    const { db, rpc } = roleDb({ exists: false });
    await expect(setUserRole(db, target)).rejects.toMatchObject({ status: 404 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("translates the last-admin rule into 409", async () => {
    const { db } = roleDb({ rpcError: { message: "cannot demote the last admin" } });
    await expect(setUserRole(db, { ...target, role: "user" })).rejects.toMatchObject({
      status: 409,
      code: "admin.last_admin",
    });
  });

  it("translates a permission error into 403 and rethrows anything else", async () => {
    const forbidden = roleDb({ rpcError: { message: "forbidden", code: "42501" } });
    await expect(setUserRole(forbidden.db, target)).rejects.toBeInstanceOf(ApiError);
    await expect(setUserRole(forbidden.db, target)).rejects.toMatchObject({ status: 403 });

    const broken = roleDb({ rpcError: { message: "boom", code: "XX000" } });
    await expect(setUserRole(broken.db, target)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("updateUserProfile / getUserProfile", () => {
  const USER = "00000000-0000-0000-0000-000000000002";
  const ACTOR = "00000000-0000-0000-0000-000000000001";
  const profileRow = (over: Record<string, unknown> = {}) => ({
    id: USER,
    nickname: "Аня",
    full_name: "Анна",
    contact: null,
    about: null,
    country_code: "BY",
    city: "Минск",
    utc_offset_minutes: 180,
    avatar_path: null,
    ...over,
  });

  it("changes only the fields that were sent and returns the new profile", async () => {
    const fake = fakeDb({
      profiles: { data: [profileRow()], writeData: [profileRow({ city: "Брест" })] },
    });
    const result = await updateUserProfile(
      fake.db,
      { userId: USER, patch: { city: "Брест" } },
      ACTOR,
    );
    expect(result).toMatchObject({ userId: USER, nickname: "Аня", city: "Брест" });
    const update = fake.calls.profiles?.find((call) => call.method === "update");
    expect(update?.args[0]).toEqual({ city: "Брест" });
  });

  it("maps the database fields (name, country, zone) and removes a photo", async () => {
    const fake = fakeDb({ profiles: { data: [profileRow()], writeData: [profileRow()] } });
    await updateUserProfile(
      fake.db,
      {
        userId: USER,
        patch: {
          nickname: "Анна_2",
          fullName: null,
          countryCode: null,
          utcOffsetMinutes: 120,
          avatarPath: null,
        },
      },
      ACTOR,
    );
    const update = fake.calls.profiles?.find((call) => call.method === "update");
    expect(update?.args[0]).toEqual({
      nickname: "Анна_2",
      full_name: null,
      country_code: null,
      utc_offset_minutes: 120,
      avatar_path: null,
    });
  });

  it("refuses to point the photo at a file: an admin can only remove it", async () => {
    const fake = fakeDb({ profiles: { data: [profileRow()] } });
    await expect(
      updateUserProfile(fake.db, { userId: USER, patch: { avatarPath: `${USER}/x.png` } }, ACTOR),
    ).rejects.toMatchObject({ status: 422 });
    expect(fake.calls.profiles).toBeUndefined();
  });

  it("says 409 for a nickname that is taken and 404 for a user who does not exist", async () => {
    const taken = fakeDb({ profiles: { writeError: { code: "23505", message: "duplicate" } } });
    await expect(
      updateUserProfile(taken.db, { userId: USER, patch: { nickname: "Борис" } }, ACTOR),
    ).rejects.toMatchObject({ status: 409, code: "profile.nickname_taken" });

    const missing = fakeDb({ profiles: { data: [], writeData: [] } });
    await expect(
      updateUserProfile(missing.db, { userId: USER, patch: { city: "x" } }, ACTOR),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("logs who changed whom and which fields, never the values", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fake = fakeDb({ profiles: { data: [profileRow()], writeData: [profileRow()] } });
    await updateUserProfile(fake.db, { userId: USER, patch: { about: "секрет" } }, ACTOR);
    const line = String(spy.mock.calls.at(-1)?.[0]);
    expect(line).toContain("admin.profile_updated");
    expect(line).toContain(ACTOR);
    expect(line).toContain("about");
    expect(line).not.toContain("секрет");
    spy.mockRestore();
  });

  it("reads one profile or null", async () => {
    expect(
      await getUserProfile(fakeDb({ profiles: { data: [profileRow()] } }).db, USER),
    ).toMatchObject({ userId: USER, nickname: "Аня" });
    expect(await getUserProfile(fakeDb({ profiles: { data: [] } }).db, USER)).toBeNull();
  });
});
