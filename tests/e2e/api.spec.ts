import { expect, test } from "@playwright/test";

// Former manual curl test cases of DAZBY-16 and DAZBY-21, run against the real server.
test.describe("API v1", () => {
  test("health answers ok with version headers", async ({ request }) => {
    const response = await request.get("/api/v1/health");
    expect(response.status()).toBe(200);
    expect(response.headers()["api-version"]).toBe("1");
    expect(response.headers()["x-request-id"]).toBeTruthy();
    const body = await response.json();
    expect(body.data.status).toBe("ok");
    expect(["ok", "error"]).toContain(body.data.checks.database);
  });

  test("strict health is 200 with every check passing or skipped, and says what it checks", async ({
    request,
  }) => {
    const response = await request.get("/api/v1/health/strict");
    expect(response.status()).toBe(200);
    const { checks } = (await response.json()).data;
    expect(checks.database).toBe("ok");
    expect(["ok", "skipped"]).toContain(checks.telegramWebhook);
  });

  test("version reports package version and supported API versions", async ({ request }) => {
    const { data } = await (await request.get("/api/v1/version")).json();
    expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(data.apiVersions).toEqual(["v1"]);
  });

  test("unknown version is a problem+json 404", async ({ request }) => {
    const response = await request.get("/api/v9/health");
    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toMatch(/^application\/problem\+json/);
    expect((await response.json()).code).toBe("api.version_unsupported");
  });

  test("unknown resource is a problem+json 404", async ({ request }) => {
    const response = await request.get("/api/v1/nope");
    expect(response.status()).toBe(404);
    expect((await response.json()).code).toBe("api.not_found");
  });

  test("openapi.json lists the public endpoints", async ({ request }) => {
    const doc = await (await request.get("/api/v1/openapi.json")).json();
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(["/health", "/version", "/openapi.json", "/videos"]),
    );
  });

  for (const limit of ["0", "101"]) {
    test(`videos rejects limit=${limit} with 422`, async ({ request }) => {
      const response = await request.get(`/api/v1/videos?limit=${limit}`);
      expect(response.status()).toBe(422);
      const body = await response.json();
      expect(body.code).toBe("api.validation_failed");
      expect(body.errors[0].field).toBe("limit");
    });
  }

  test("own profile endpoints require sign-in", async ({ request }) => {
    for (const response of [
      await request.get("/api/v1/me"),
      await request.patch("/api/v1/me", { data: { city: "Минск" } }),
    ]) {
      expect(response.status()).toBe(401);
      expect(response.headers()["content-type"]).toMatch(/^application\/problem\+json/);
      expect((await response.json()).code).toBe("auth.required");
    }
  });

  test("nickname availability talks to the real database", async ({ request }) => {
    const check = async (nickname: string) =>
      (
        await (
          await request.get(
            `/api/v1/nickname-availability?nickname=${encodeURIComponent(nickname)}`,
          )
        ).json()
      ).data;
    expect(await check("a b")).toEqual({ valid: false, available: false });
    expect(await check("Свободный_ник_" + Date.now().toString().slice(-4))).toEqual({
      valid: true,
      available: true,
    });
  });
});
