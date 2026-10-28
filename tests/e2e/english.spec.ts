import { en } from "../../src/messages/en";
import { ru } from "../../src/messages/ru";
import { expect, openMenu, test } from "./helpers/fixtures";

/** Every text of the participant interface that differs between the languages (admin is Russian only). */
function differingTexts(): string[] {
  const found: string[] = [];
  const walk = (russian: unknown, english: unknown) => {
    if (typeof russian === "string" && typeof english === "string") {
      if (russian !== english) found.push(russian);
    } else if (russian && typeof russian === "object" && english && typeof english === "object") {
      for (const key of Object.keys(russian)) {
        if (key === "admin") continue;
        walk((russian as Record<string, unknown>)[key], (english as Record<string, unknown>)[key]);
      }
    }
  };
  walk(ru, en);
  return found;
}

/** The parts of a Russian text that are really words: placeholders and short bits are dropped. */
function fragments(text: string): string[] {
  return text
    .split(/\{[a-z]+\}/)
    .map((part) => part.trim())
    .filter((part) => /[А-Яа-яЁё]/.test(part) && part.length >= 6);
}

test.describe("English interface (D-088)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: "lang", value: "en", url: baseURL! }]);
  });

  test("the home page speaks English", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Football is more fun when you are in the game",
    );
    await expect(page.getByRole("link", { name: "Sign in with Telegram" }).first()).toBeVisible();
    await expect(page).toHaveTitle("Da Zabey");
    await openMenu(page);
    await expect(page.getByRole("link", { name: "Standings" }).first()).toBeVisible();
  });

  const pages = ["/", "/rating", "/predictions", "/login", "/this-page-does-not-exist"];
  for (const path of pages) {
    test(`${path} has no Russian interface text left`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await page.waitForLoadState("networkidle");
      const text = await page.locator("body").innerText();
      const leftovers = differingTexts()
        .flatMap(fragments)
        .filter((fragment) => text.includes(fragment));
      expect(leftovers, `Russian texts found on ${path}`).toEqual([]);
    });
  }

  test("the switcher in the footer changes the language and remembers it", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");

    const footer = page.getByRole("contentinfo");
    await footer.getByRole("button", { name: "Язык: Русский" }).click();
    await page.getByRole("menuitemradio", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(footer.getByRole("button", { name: "Language: English" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");

    // The choice survives a navigation and a reload.
    await page.goto("/rating");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Standings");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await footer.getByRole("button", { name: "Language: English" }).click();
    await page.getByRole("menuitemradio", { name: "Русский" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Рейтинг");
  });

  test("the switcher in the header (flag and code) changes the language", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/");
    const header = page.getByRole("banner");
    await header.getByRole("button", { name: "Язык: Русский" }).click();
    await page.getByRole("menuitemradio", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(header.getByRole("button", { name: "Language: English" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Support" })).toBeVisible();
  });
});
