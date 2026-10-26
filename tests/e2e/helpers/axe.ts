import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** Waits for the first-visit cover to lift and the page's fade-in to end, so axe sees the real page. */
export async function settleForAxe(page: Page) {
  await page.waitForLoadState("load");
  await page.locator("#site-loader").waitFor({ state: "hidden" });
  // Infinite animations (the spinner) never finish; only wait for the ones that do.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => null)),
    ),
  );
}

export type Violation = { id: string; impact: string; nodes: string[] };

/** WCAG 2.0/2.1 A and AA checks; returns a short, readable list of what is wrong. */
export async function accessibilityViolations(page: Page): Promise<Violation[]> {
  await settleForAxe(page);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The embedded YouTube player is not ours to fix.
    .exclude("iframe")
    .analyze();
  return result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? "unknown",
    nodes: violation.nodes
      .slice(0, 4)
      .map((node) => `${node.target.join(" ")} :: ${node.failureSummary?.split("\n")[1] ?? ""}`),
  }));
}
