import { type Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";

/**
 * The home page streams: until the session is known the static copy (the guest landing) is in the
 * page next to the final one. Wait for the swap so every locator sees one copy.
 */
async function openHome(page: Page) {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
}

test.describe("landing (guest)", () => {
  test("says what the site is and offers one main action", async ({ page }) => {
    await openHome(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Футбол интереснее, когда ты в игре" }),
    ).toBeVisible();
    const action = page.getByRole("link", { name: "Войти через Telegram" });
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute("href", /\/login\?next=%2Fpredictions/);
  });

  test("explains how it works in three steps with an example of the rating", async ({ page }) => {
    await openHome(page);
    const how = page.getByRole("region", { name: "Как это работает" });
    await expect(how).toBeVisible();
    await expect(how.locator("ol > li")).toHaveCount(3);
    await expect(page.getByText("Пример рейтинга")).toBeVisible();
  });

  test("shows the next matches or the coming-soon message, then the videos", async ({ page }) => {
    await openHome(page);
    await expect(page.getByRole("heading", { level: 2, name: "Ближайшие матчи" })).toBeVisible();
    await expect(
      page
        .getByText("Скоро начнём")
        .or(page.getByRole("link", { name: "Сделать прогноз" }).first()),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 2, name: "Свежие видео" })).toBeVisible();
  });

  test("answers questions: one open at a time", async ({ page }) => {
    await openHome(page);
    const first = page.getByText("Что такое «Да забей»?");
    const second = page.getByText("Это бесплатно?");
    await first.scrollIntoViewIfNeeded();
    await expect(page.getByText(/Это сайт канала/)).toBeVisible();
    await second.click();
    await expect(page.getByText(/Участие в турнире бесплатное/)).toBeVisible();
    await expect(page.getByText(/Это сайт канала/)).toBeHidden();
  });

  test("match rows keep both clubs, the time and the button inside the screen", async ({
    page,
  }) => {
    await openHome(page);
    const card = page
      .getByRole("heading", { name: "Ближайшие матчи" })
      .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
    const rows = card.locator("ul > li");
    test.skip((await rows.count()) === 0, "no matches in the next tour right now");
    const viewport = page.viewportSize()!;
    for (const row of await rows.all()) {
      const names = row.locator("span.font-semibold");
      await expect(names).toHaveCount(2);
      for (const name of await names.all()) {
        const box = await name.boundingBox();
        expect(box!.width, "a club name must not be squeezed out").toBeGreaterThan(40);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      }
      const button = await row.getByRole("link", { name: "Сделать прогноз" }).boundingBox();
      expect(button!.x).toBeGreaterThanOrEqual(0);
      expect(button!.x + button!.width).toBeLessThanOrEqual(viewport.width);
      expect(button!.height).toBeGreaterThanOrEqual(40);
    }
  });

  test("the calls to action carry their Umami event, so clicks are counted by place", async ({
    page,
  }) => {
    await openHome(page);
    const hero = page.getByRole("link", { name: "Войти через Telegram" });
    await expect(hero).toHaveAttribute("data-umami-event", "cta-click");
    await expect(hero).toHaveAttribute("data-umami-event-where", "hero");
    const header = page.getByRole("banner").getByRole("link", { name: "Войти" });
    await expect(header).toHaveAttribute("data-umami-event-where", "header");
  });

  test("the first-visit cover lifts once the page has loaded", async ({ page }) => {
    await openHome(page);
    await expect(page.locator("html")).toHaveAttribute("data-ready", "");
    await expect(page.locator("#site-loader")).toBeHidden();
  });

  test("fits the screen and the action is reachable without scrolling far", async ({ page }) => {
    await openHome(page);
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
