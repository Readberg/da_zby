import { accessibilityViolations } from "./helpers/axe";
import { expect, test } from "./helpers/fixtures";

// Accessibility (WCAG 2.1 A and AA, axe-core) of the public pages in both themes (D-078).
const pages = ["/", "/predictions", "/rating", "/login", "/this-page-does-not-exist"];

for (const scheme of ["light", "dark"] as const) {
  for (const path of pages) {
    test(`${path} has no accessibility violations (${scheme} theme)`, async ({
      page,
    }, testInfo) => {
      // Contrast depends on the theme, not on the width: on a phone the dark theme is enough.
      test.skip(testInfo.project.name === "mobile" && scheme === "light", "covered on the desktop");
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "no-preference" });
      await page.goto(path);
      expect(await accessibilityViolations(page)).toEqual([]);
    });
  }
}
