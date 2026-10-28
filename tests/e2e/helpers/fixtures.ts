import { expect, test as base, type Page } from "@playwright/test";

/**
 * Until the session is known the home page holds its static copy next to the final one; a locator
 * run in that moment sees two of everything (and a heading that is about to be replaced). After
 * every navigation wait until at most one <h1> is left, so no test has to know about the swap.
 */
async function settle(page: Page) {
  try {
    await page.waitForFunction(() => document.querySelectorAll("h1").length <= 1, undefined, {
      timeout: 5_000,
    });
  } catch {
    // Navigated away or closed meanwhile; the test's own assertions decide.
  }
}

export const test = base.extend({
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    page.goto = (async (url, options) => {
      const response = await goto(url, options);
      await settle(page);
      return response;
    }) as Page["goto"];
    await provide(page);
  },
});

export { expect };

/**
 * On a phone the header links live in the burger panel. Unfolds it (when there is a burger on the
 * screen) and waits until it is open; a click before the page is interactive is simply repeated.
 */
export async function openMenu(page: Page) {
  const burger = page.getByRole("button", { name: /^(Меню|Menu)$/ });
  if (!(await burger.isVisible())) return;
  await expect(async () => {
    if ((await burger.getAttribute("aria-expanded")) !== "true") await burger.click();
    await expect(burger).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}
