import { expect, test } from "./helpers/fixtures";

// Keyboard and reduced-motion behaviour (D-078).
test.describe("keyboard", () => {
  test("the first Tab stop skips the header and lands on the page", async ({ page }) => {
    await page.goto("/rating");
    await page.locator("#site-loader").waitFor({ state: "hidden" });
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Перейти к содержимому" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("#content")).toBeFocused();
  });

  test("the landing can be driven without a mouse: the main action, the questions", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#site-loader").waitFor({ state: "hidden" });
    const action = page.getByRole("link", { name: "Войти через Telegram" });
    await action.focus();
    await expect(action).toBeFocused();

    const second = page.getByRole("button", { name: "Это бесплатно?" });
    await second.focus();
    await page.keyboard.press("Enter");
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Space");
    await expect(second).toHaveAttribute("aria-expanded", "false");

    await action.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/login/);
  });

  test("every control that takes focus shows where the focus is", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#site-loader").waitFor({ state: "hidden" });
    const missing: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const outline = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return null;
        const style = getComputedStyle(element);
        const visible =
          (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2) ||
          style.boxShadow !== "none";
        return { name: element.textContent?.trim().slice(0, 30) || element.tagName, visible };
      });
      if (outline && !outline.visible) missing.push(outline.name);
    }
    expect(missing).toEqual([]);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing animates for longer than an instant, and the page is usable at once", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#site-loader").waitFor({ state: "hidden" });
    const long = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => Number(animation.effect?.getComputedTiming().duration))
        .filter((duration) => duration > 50),
    );
    expect(long).toEqual([]);
    await expect(page.getByRole("link", { name: "Войти через Telegram" })).toBeVisible();
  });
});
