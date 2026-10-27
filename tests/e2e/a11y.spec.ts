import { accessibilityViolations } from "./helpers/axe";
import { expect, test } from "./helpers/fixtures";

// Accessibility (WCAG 2.1 A and AA, axe-core) of the public pages; the site is dark only (D-106).
const pages = ["/", "/predictions", "/rating", "/login", "/this-page-does-not-exist"];

for (const path of pages) {
  test(`${path} has no accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(path);
    expect(await accessibilityViolations(page)).toEqual([]);
  });
}
