import { expect, test } from "./helpers/fixtures";

test.describe("themes", () => {
  test("the toggle switches the theme and the choice survives a reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const root = page.locator("html");
    await expect(root).not.toHaveAttribute("data-theme", /.+/);

    const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.getByRole("button", { name: /Переключить тему/ }).click();
    await expect(root).toHaveAttribute("data-theme", "dark");
    const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgAfter).not.toBe(bgBefore);

    await page.reload();
    await expect(root).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      bgAfter,
    );
  });

  test("without a choice the page follows the system theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/login");
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: "light" });
    const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(dark).not.toBe(light);
  });

  test("the sign-in pill is inverse to the page in both themes", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await expect(page.locator("h1")).toHaveCount(1);
      const login = page.getByRole("banner").getByRole("link", { name: "Войти" });
      await expect(login).toBeVisible();
      const {
        color,
        background,
        page: pageBg,
      } = await login.evaluate((el) => ({
        color: getComputedStyle(el).color,
        background: getComputedStyle(el).backgroundColor,
        page: getComputedStyle(document.body).backgroundColor,
      }));
      expect(color).toBe(pageBg);
      expect(background).not.toBe(pageBg);
    }
  });

  test("text on the yellow accent is black in both themes", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await expect(page.locator("h1")).toHaveCount(1);
      const cta = page.getByRole("link", { name: "Войти через Telegram" });
      await expect(cta).toBeVisible();
      expect(await cta.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(0, 0, 0)");
    }
  });
});
