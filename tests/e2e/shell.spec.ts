import { expect, openMenu, test } from "./helpers/fixtures";

test("header and footer are present and fit the screen", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await openMenu(page);
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

test.describe("burger menu on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "the burger exists below 1024 px");

  test("the links are in the burger, which opens, leads to a page and folds", async ({ page }) => {
    await page.goto("/");
    const burger = page.getByRole("button", { name: "Меню" });
    await expect(burger).toBeVisible();
    // Not a second row of links: until the burger is opened there is no link to a section.
    await expect(page.getByRole("banner").getByRole("link", { name: "Рейтинг" })).toHaveCount(0);

    await openMenu(page);
    for (const name of ["Главная", "Прогнозы", "Рейтинг", "Таблица", "Чат", "Войти"]) {
      await expect(page.getByRole("banner").getByRole("link", { name })).toBeVisible();
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    await page.getByRole("banner").getByRole("link", { name: "Рейтинг" }).click();
    await expect(page).toHaveURL(/\/rating$/);
    await expect(burger).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape folds the open menu", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Меню" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
