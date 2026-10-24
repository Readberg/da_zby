import { expect, test } from "@playwright/test";

test("home page opens and shows the site title", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/Да забей/);
  expect(errors).toEqual([]);
});
