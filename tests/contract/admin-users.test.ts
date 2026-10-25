// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminUserRoleSchema, adminUsersSchema } from "@/server/api/v1/schemas/admin";
import { ApiError } from "@/server/api/v1/problem";
import { apiRequest, expectApiHeaders, expectProblem } from "./helpers";

const createClient = vi.fn();
const listUsers = vi.fn();
const setUserRole = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/server/services/admin-users", () => ({ listUsers, setUserRole }));

const users = await import("@/app/api/v1/admin/users/route");
const role = await import("@/app/api/v1/admin/users/role/route");

const USER_ID = "11111111-1111-4111-8111-111111111112";

function client(who: "guest" | "user" | "admin") {
  createClient.mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: who === "guest" ? null : { id: "u1" } },
        error: null,
      })),
    },
    rpc: vi.fn(async () => ({ data: who === "admin", error: null })),
  });
}

const list = (query = "") => apiRequest(`/api/v1/admin/users${query}`);
const patch = (body: unknown) =>
  apiRequest("/api/v1/admin/users/role", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  listUsers.mockReset().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  setUserRole.mockReset().mockResolvedValue({ userId: USER_ID, role: "admin" });
});

describe("GET /api/v1/admin/users", () => {
  it("is closed to guests (401) and to ordinary users (403)", async () => {
    client("guest");
    await expectProblem(await users.GET(list()), 401, "auth.required");
    client("user");
    await expectProblem(await users.GET(list()), 403, "auth.forbidden");
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("returns the list to an admin and passes the search and paging through", async () => {
    client("admin");
    const response = await users.GET(list("?search=%D1%80%D0%BE&page=2&pageSize=10"));
    expectApiHeaders(response);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    adminUsersSchema.parse((await response.json()).data);
    expect(listUsers).toHaveBeenCalledWith(expect.anything(), {
      search: "ро",
      page: 2,
      pageSize: 10,
    });
  });

  it("uses defaults and rejects absurd paging", async () => {
    client("admin");
    await users.GET(list());
    expect(listUsers).toHaveBeenLastCalledWith(expect.anything(), {
      search: undefined,
      page: 1,
      pageSize: 50,
    });
    await expectProblem(await users.GET(list("?pageSize=1000")), 422, "api.validation_failed");
  });
});

describe("PATCH /api/v1/admin/users/role", () => {
  it("is closed to guests and ordinary users", async () => {
    client("guest");
    await expectProblem(
      await role.PATCH(patch({ userId: USER_ID, role: "admin" })),
      401,
      "auth.required",
    );
    client("user");
    await expectProblem(
      await role.PATCH(patch({ userId: USER_ID, role: "admin" })),
      403,
      "auth.forbidden",
    );
    expect(setUserRole).not.toHaveBeenCalled();
  });

  it("changes the role for an admin", async () => {
    client("admin");
    const response = await role.PATCH(patch({ userId: USER_ID, role: "admin" }));
    expect(response.status).toBe(200);
    adminUserRoleSchema.parse((await response.json()).data);
    expect(setUserRole).toHaveBeenCalledWith(expect.anything(), {
      userId: USER_ID,
      role: "admin",
    });
  });

  it("validates the body", async () => {
    client("admin");
    await expectProblem(
      await role.PATCH(patch({ userId: "not-a-uuid", role: "root" })),
      422,
      "api.validation_failed",
    );
    expect(setUserRole).not.toHaveBeenCalled();
  });

  it("reports the last-admin rule as 409", async () => {
    client("admin");
    setUserRole.mockRejectedValue(
      new ApiError(409, "admin.last_admin", "Conflict", "The last admin cannot be demoted."),
    );
    await expectProblem(
      await role.PATCH(patch({ userId: USER_ID, role: "user" })),
      409,
      "admin.last_admin",
    );
  });
});
