import { expect, test } from "./helpers/fixtures";

test("home page opens and shows the site title", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/Да забей/);
  // Videos come from YouTube at request time: accept either the embedded player or the fallback block.
  // The embed is put on the page when it is about to be seen (DAZBY-112): scroll to the video like a visitor,
  // again and again because the videos stream in after the first paint.
  await expect(async () => {
    await page.evaluate(() =>
      document.querySelector("#current-video-title")?.scrollIntoView({ block: "center" }),
    );
    await expect(
      page
        .locator('iframe[title^="Видеоплеер YouTube"]')
        .or(page.getByRole("link", { name: /Перейти на канал/ })),
    ).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
