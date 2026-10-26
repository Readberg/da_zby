import { expect, test } from "./helpers/fixtures";

/**
 * Performance budgets measured in the browser on the production build (D-078): the size of our own
 * scripts, layout shift, the largest paint, and how long the first-visit cover stays up. Third-party
 * resources (the YouTube player) are left out of the size budget on purpose: they are lazy and the
 * cover does not wait for them. The numbers have headroom for a slow CI machine; a breach means
 * something heavy was added, not that the machine was slow.
 */
const budgets: Record<string, { ownJsKb: number }> = {
  "/": { ownJsKb: 700 },
  "/predictions": { ownJsKb: 650 },
  "/rating": { ownJsKb: 650 },
  "/login": { ownJsKb: 650 },
};

test.describe("performance budgets", () => {
  test.skip(({ isMobile }) => isMobile, "measured once, on the desktop project");

  for (const [path, budget] of Object.entries(budgets)) {
    test(`${path} stays within its budgets`, async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      let ownJsBytes = 0;
      page.on("response", async (response) => {
        const request = response.request();
        if (request.resourceType() !== "script" || !response.url().startsWith(origin)) return;
        ownJsBytes += (await response.body().catch(() => Buffer.alloc(0))).length;
      });
      await page.addInitScript(() => {
        const w = window as unknown as { __m: { lcp: number; cls: number; ready: number } };
        w.__m = { lcp: 0, cls: 0, ready: 0 };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) w.__m.lcp = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as {
            hadRecentInput: boolean;
            value: number;
          }[])
            if (!entry.hadRecentInput) w.__m.cls += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
        new MutationObserver(() => {
          if (document.documentElement.hasAttribute("data-ready") && !w.__m.ready)
            w.__m.ready = performance.now();
        }).observe(document, { attributes: true, subtree: true });
      });

      await page.goto(path);
      await page.locator("#site-loader").waitFor({ state: "hidden" });
      await page.waitForTimeout(1500);
      const metrics = await page.evaluate(
        () => (window as unknown as { __m: { lcp: number; cls: number; ready: number } }).__m,
      );

      expect(ownJsBytes / 1024, "own JavaScript, KB (decoded)").toBeLessThan(budget.ownJsKb);
      expect(metrics.cls, "cumulative layout shift").toBeLessThan(0.1);
      expect(metrics.lcp, "largest contentful paint, ms").toBeLessThan(2500);
      expect(metrics.ready, "first-visit cover lifted after, ms").toBeGreaterThan(0);
      expect(metrics.ready, "first-visit cover lifted after, ms").toBeLessThan(2000);
    });
  }
});
