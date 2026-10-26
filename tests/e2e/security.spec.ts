import { expect, test } from "./helpers/fixtures";

// Security headers (D-074, D-076). The content policy is enforced: a blocked resource shows up as a
// console message, and this test turns every such message into a failure.
test.describe("security headers", () => {
  test("every page carries the headers", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy-report-only"]).toBeUndefined();
  });

  test("the API answers carry them too", async ({ request }) => {
    const response = await request.get("/api/v1/health");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });

  for (const path of ["/", "/predictions", "/rating", "/login"]) {
    test(`${path} loads without a single content-policy violation`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "one run is enough");
      const violations: string[] = [];
      page.on("console", (message) => {
        const text = message.text();
        if (/content security policy|\[report only\]/i.test(text)) violations.push(text);
      });
      await page.goto(path);
      await page.waitForLoadState("load");
      await page.waitForTimeout(2500);
      expect(violations).toEqual([]);
    });
  }
});
