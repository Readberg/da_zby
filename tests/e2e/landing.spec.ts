import { expect, test } from "@playwright/test";

test.describe("landing (guest)", () => {
  test("says what the site is and offers one main action", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Футбол интереснее, когда ты в игре" }),
    ).toBeVisible();
    const action = page.getByRole("link", { name: "Войти через Telegram" });
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute("href", /\/login\?next=%2Fpredictions/);
  });

  test("explains how it works in three steps with an example of the rating", async ({ page }) => {
    await page.goto("/");
    const how = page.getByRole("region", { name: "Как это работает" });
    await expect(how).toBeVisible();
    await expect(how.locator("ol > li")).toHaveCount(3);
    await expect(page.getByText("Пример рейтинга")).toBeVisible();
  });

  test("shows the next matches or the coming-soon message, then the videos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Ближайшие матчи" })).toBeVisible();
    await expect(
      page
        .getByText("Скоро начнём")
        .or(page.getByRole("link", { name: "Сделать прогноз" }).first()),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 2, name: "Свежие видео" })).toBeVisible();
  });

  test("answers questions: one open at a time", async ({ page }) => {
    await page.goto("/");
    const first = page.getByText("Что такое «Да забей»?");
    const second = page.getByText("Это бесплатно?");
    await first.scrollIntoViewIfNeeded();
    await expect(page.getByText(/Это сайт канала/)).toBeVisible();
    await second.click();
    await expect(page.getByText(/Участие в турнире бесплатное/)).toBeVisible();
    await expect(page.getByText(/Это сайт канала/)).toBeHidden();
  });

  test("fits the screen and the action is reachable without scrolling far", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    const box = await page.getByRole("link", { name: "Войти через Telegram" }).boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.y + box!.height).toBeLessThan(viewport.height);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
