import { expect, test } from "./helpers/fixtures";

/** The language lives in a cookie; addresses never carry it (D-088). */
test.describe("language routing", () => {
  test("without a cookie the page is Russian", async ({ page }) => {
    await page.goto("/rating");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    expect(new URL(page.url()).pathname).toBe("/rating");
  });

  test("the cookie picks the language and the address stays the same", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "lang", value: "en", url: baseURL! }]);
    await page.goto("/rating");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(new URL(page.url()).pathname).toBe("/rating");
  });

  test("a wrong cookie falls back to Russian", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "lang", value: "de", url: baseURL! }]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  });

  test("an address that carries a language is sent to its plain form", async ({ page }) => {
    await page.goto("/en/rating");
    expect(new URL(page.url()).pathname).toBe("/rating");
    await page.goto("/ru");
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("API addresses are not touched", async ({ request }) => {
    const response = await request.get("/api/v1/version");
    expect(response.status()).toBe(200);
  });
});
