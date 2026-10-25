// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import { listUsers, setUserRole } from "./admin-users";

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
