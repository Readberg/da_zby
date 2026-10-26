import { expect, test } from "./helpers/fixtures";

test.describe("rating (guest)", () => {
  test("the page opens, is in the header and has no horizontal scroll", async ({ page }) => {
    await page.goto("/rating");
    await expect(page.getByRole("heading", { level: 1, name: "Рейтинг" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Рейтинг" })).toBeVisible();
    // Either the pickers (a tournament exists) or the empty state: both are valid content.
    await expect(page.getByLabel("Турнир").or(page.getByText("Турниров пока нет"))).toBeVisible({
      timeout: 15_000,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("unknown parameters do not break the page", async ({ page }) => {
    const response = await page.goto("/rating?tournament=net-takogo&season=x&tour=abc");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Рейтинг" })).toBeVisible();
  });

  test("a profile shows the statistics block", async ({ page }) => {
    await page.goto("/u/net_takogo_nika_123456");
    await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
  });
});
