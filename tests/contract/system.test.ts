// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildOpenApiDocument } from "@/server/api/v1/openapi";
import { healthSchema, versionSchema } from "@/server/api/v1/schemas/system";
import { apiRequest, expectApiHeaders, expectProblem, fakeSupabase } from "./helpers";

const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const health = await import("@/app/api/v1/health/route");
const version = await import("@/app/api/v1/version/route");
const openapi = await import("@/app/api/v1/openapi.json/route");
const fallback = await import("@/app/api/[version]/[[...path]]/route");

function ctx(versionParam: string, path?: string[]) {
  return { params: Promise.resolve({ version: versionParam, path }) };
}

describe("GET /api/v1/health", () => {
  beforeEach(() => createClient.mockReset());

  it("returns ok with a healthy database", async () => {
    createClient.mockResolvedValue(fakeSupabase({ error: null }));
    const response = await health.GET(apiRequest("/api/v1/health"));

    expect(response.status).toBe(200);
    expectApiHeaders(response);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(healthSchema.parse(body.data)).toEqual({ status: "ok", checks: { database: "ok" } });
    expect(body.meta).toEqual({});
  });

  it("stays up and reports the database error", async () => {
    createClient.mockResolvedValue(fakeSupabase({ error: { code: "PGRST205" } }));
    const response = await health.GET(apiRequest("/api/v1/health"));

    expect(response.status).toBe(200);
    expect((await response.json()).data.checks.database).toBe("error");
  });
  it("echoes a valid incoming X-Request-Id", async () => {
    createClient.mockResolvedValue(fakeSupabase());
    const response = await health.GET(
      apiRequest("/api/v1/health", { headers: { "x-request-id": "trace-123" } }),
    );
    expect(response.headers.get("X-Request-Id")).toBe("trace-123");
  });
});

describe("GET /api/v1/version", () => {
  it("returns the package version and supported API versions", async () => {
    createClient.mockResolvedValue(fakeSupabase());
    const response = await version.GET(apiRequest("/api/v1/version"));

    expect(response.status).toBe(200);
    expectApiHeaders(response);
    const { data } = await response.json();
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(versionSchema.parse(data)).toMatchObject({ version: pkg.version, apiVersions: ["v1"] });
  });
});

describe("GET /api/v1/openapi.json", () => {
  it("serves the OpenAPI document with the three system paths", async () => {
    const response = await openapi.GET(apiRequest("/api/v1/openapi.json"));

    expect(response.status).toBe(200);
    expectApiHeaders(response);
    const doc = await response.json();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(["/health", "/version", "/openapi.json"]),
    );
  });

  it("matches the committed snapshot (run `pnpm api:openapi` after changing the API)", () => {
    const snapshot = JSON.parse(readFileSync("docs/api/openapi.v1.json", "utf8"));
    expect(buildOpenApiDocument()).toEqual(snapshot);
  });
});

describe("unknown API routes", () => {
  it("rejects an unsupported version with api.version_unsupported", async () => {
    const response = await fallback.GET(apiRequest("/api/v9/health"), ctx("v9", ["health"]));
    const body = await expectProblem(response, 404, "api.version_unsupported");
    expect(body.supportedVersions).toEqual(["v1"]);
    expect(body.instance).toBe("/api/v9/health");
  });

  it("returns api.not_found for an unknown resource of v1", async () => {
    const response = await fallback.GET(apiRequest("/api/v1/nope"), ctx("v1", ["nope"]));
    await expectProblem(response, 404, "api.not_found");
  });

  it("handles non-GET methods the same way", async () => {
    const response = await fallback.POST(
      apiRequest("/api/v2/things", { method: "POST" }),
      ctx("v2", ["things"]),
    );
    await expectProblem(response, 404, "api.version_unsupported");
  });
});
