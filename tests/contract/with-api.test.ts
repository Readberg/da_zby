// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineEndpoint } from "@/server/api/v1/endpoint";
import { apiRequest, expectProblem, fakeSupabase } from "./helpers";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { withApi } = await import("@/server/api/v1/with-api");

const endpoint = (auth: "public" | "user" | "admin") =>
  defineEndpoint({
    method: "get",
    path: "/test",
    summary: "test",
    tags: ["test"],
    auth,
    query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }),
    output: z.object({ limit: z.number() }),
    cacheControl: "no-store",
  });

describe("withApi", () => {
  beforeEach(() => createClient.mockReset());

  it("validates the query and answers 422 with field errors", async () => {
    createClient.mockResolvedValue(fakeSupabase());
    const route = withApi(endpoint("public"), async ({ query }) => ({ data: query }));

    const body = await expectProblem(
      await route(apiRequest("/api/v1/test?limit=0")),
      422,
      "api.validation_failed",
    );
    expect(body.errors?.[0]?.field).toBe("limit");
  });

  it("applies query defaults", async () => {
    createClient.mockResolvedValue(fakeSupabase());
    const route = withApi(endpoint("public"), async ({ query }) => ({ data: query }));
    const response = await route(apiRequest("/api/v1/test"));
    expect((await response.json()).data).toEqual({ limit: 20 });
  });

  it("requires a user for user-level endpoints", async () => {
    createClient.mockResolvedValue(fakeSupabase({ error: null }, { user: null }));
    const route = withApi(endpoint("user"), async ({ query }) => ({ data: query }));
    await expectProblem(await route(apiRequest("/api/v1/test")), 401, "auth.required");
  });

  it("forbids non-admins on admin endpoints", async () => {
    createClient.mockResolvedValue(fakeSupabase({ error: null }, { user: { id: "u1" } }));
    const route = withApi(endpoint("admin"), async ({ query }) => ({ data: query }));
    await expectProblem(await route(apiRequest("/api/v1/test")), 403, "auth.forbidden");
  });

  it("uses the bearer token when one is sent", async () => {
    const supabase = fakeSupabase({ error: null }, { user: { id: "u1" } });
    createClient.mockResolvedValue(supabase);
    const route = withApi(endpoint("user"), async ({ query }) => ({ data: query }));

    const response = await route(
      apiRequest("/api/v1/test", { headers: { authorization: "Bearer token-1" } }),
    );
    expect(response.status).toBe(200);
    expect(supabase.auth.getUser).toHaveBeenCalledWith("token-1");
    // The queries of the handler are made as that user too, not as a guest (DAZBY-119).
    expect(createClient).toHaveBeenCalledWith("token-1");
  });

  it("turns an output contract violation into a 500 problem", async () => {
    createClient.mockResolvedValue(fakeSupabase());
    vi.spyOn(console, "error").mockImplementation(() => {});
    const route = withApi(endpoint("public"), async () => ({
      data: { limit: "oops" } as unknown as { limit: number },
    }));
    await expectProblem(await route(apiRequest("/api/v1/test")), 500, "api.internal_error");
  });
});

describe("withApi order of checks", () => {
  it("answers 401 to an anonymous caller before it looks at the query", async () => {
    createClient.mockResolvedValue(fakeSupabase({ error: null }, { user: null }));
    const route = withApi(endpoint("user"), async ({ query }) => ({ data: query }));
    await expectProblem(await route(apiRequest("/api/v1/test?limit=0")), 401, "auth.required");
  });
});
