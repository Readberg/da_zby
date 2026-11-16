import { expect, test } from "./helpers/fixtures";

/**
 * The football manager (D-129) is for signed-in users. Making a club writes to the one shared
 * database (dev = production, D-080), so no test creates one; the full flow is covered by the unit
 * and contract tests and by the owner's acceptance.
 */
test.describe("the football manager for a guest", () => {
  test("sends a guest from /manager to the login page and back afterwards", async ({ page }) => {
    await page.goto("/manager");
    await expect(page).toHaveURL(/\/login\?next=%2Fmanager/);
  });

  test("refuses the API without a session", async ({ request }) => {
    const response = await request.get("/api/v1/manager/club");
    expect(response.status()).toBe(401);
  });

  test("keeps the section out of search results", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    if (sitemap.ok()) expect(await sitemap.text()).not.toContain("/manager");
  });
});
