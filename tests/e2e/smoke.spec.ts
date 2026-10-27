import { expect, test } from "./helpers/fixtures";

test("home page opens and shows the site title", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/Да забей/);
  // Videos come from YouTube at request time: accept either the embedded player or the fallback block.
  // The cover with a Play button stands in for the player until a click (DAZBY-115); the videos stream in after the first paint.
  await expect(
    page
      .getByRole("button", { name: /Смотреть видео/ })
      .or(page.getByRole("link", { name: /Перейти на канал/ })),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('iframe[title^="Видеоплеер YouTube"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
