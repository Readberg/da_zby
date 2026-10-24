import { expect, test } from "@playwright/test";

const COMPONENTS_DIR = "docs/design/components";
const SCREENS_DIR = "docs/design/screens";

test("component snapshots from /styleguide", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/styleguide");
  await page.evaluate(() => document.fonts.ready);

  const sections = page.locator("[data-snap]");
  const ids = await sections.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-snap") ?? ""),
  );
  expect(ids.length).toBeGreaterThan(0);

  for (const id of ids) {
    await page.locator(`[data-snap="${id}"]`).screenshot({
      path: `${COMPONENTS_DIR}/${id}.png`,
      animations: "disabled",
    });
  }
});

const screens = [
  { name: "home", path: "/" },
  { name: "not-found", path: "/no-such-page" },
];

for (const screen of screens) {
  for (const [device, viewport] of [
    ["mobile", { width: 360, height: 780 }],
    ["desktop", { width: 1280, height: 800 }],
  ] as const) {
    test(`screen ${screen.name} (${device})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(screen.path);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${SCREENS_DIR}/${screen.name}-${device}.png`,
        fullPage: true,
        animations: "disabled",
      });
    });
  }
}
