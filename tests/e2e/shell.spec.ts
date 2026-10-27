import { expect, test } from "./helpers/fixtures";

test("header and footer are present and fit the screen", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("link", { name: "Главная" })).toHaveAttribute("aria-current", "page");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("unknown pages show the 404 page with a link home", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  // The 404 shell is drawn by the browser (inline scripts do not run there): the cover must still lift soon.
  await expect(page.locator("html")).toHaveAttribute("data-ready", "", { timeout: 3000 });
  await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
  await page.getByRole("link", { name: "На главную", exact: true }).click();
  await expect(page).toHaveURL("/");
});
