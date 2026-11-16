import { expect, test } from "./helpers/fixtures";

/**
 * The admin console (DAZBY-152) is for admins and moderators. Without a session a guest is sent to
 * the login page and every console endpoint answers 401; a signed-in staff run is covered by the
 * unit tests of the registry, the permissions and the actions, and by the SQL checks.
 */
test.describe("the admin console for a guest", () => {
  for (const path of ["/admin/data", "/admin/data/clubs", "/admin/suspicious"]) {
    test(`sends a guest from ${path} to the login page`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?next=/);
    });
  }

  for (const path of [
    "/api/v1/admin/console/records?entity=clubs",
    "/api/v1/admin/console/suspicious",
  ]) {
    test(`refuses ${path} without a session`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(401);
    });
  }

  test("refuses an action without a session", async ({ request }) => {
    const response = await request.post("/api/v1/admin/console/actions", {
      data: { action: "freeze_market", targets: ["x"], reason: "no session" },
    });
    expect(response.status()).toBe(401);
  });
});
