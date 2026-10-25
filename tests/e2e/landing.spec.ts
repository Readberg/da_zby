import { expect, test } from "@playwright/test";

test.describe("landing (guest)", () => {
  test("says what the site is and offers one main action", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Футбол интереснее, когда ты в игре" }),
    ).toBeVisible();
    const action = page.getByRole("link", { name: "Войти и сделать прогноз" });
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute("href", /\/login\?next=%2Fpredictions/);
  });

  test("explains how it works in three steps", async ({ page }) => {
    await page.goto("/");
    const how = page.getByRole("region", { name: "Как это работает" });
    await expect(how).toBeVisible();
    await expect(how.getByRole("listitem")).toHaveCount(3);
    await page.getByRole("link", { name: "Как это работает" }).first().click();
    await expect(page).toHaveURL(/#how$/);
  });

  test("shows the next tour or the coming-soon message, then the videos", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("Скоро начнём").or(page.getByRole("heading", { name: /Ближайший тур/ })),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 2, name: "Свежие видео" })).toBeVisible();
  });

  test("fits the screen and the action is reachable without scrolling far", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    const box = await page.getByRole("link", { name: "Войти и сделать прогноз" }).boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.y + box!.height).toBeLessThan(viewport.height);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
