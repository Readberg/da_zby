import { expect, test } from "./helpers/fixtures";

/** Link previews (D-091): the page names its own image and the image is a real 1200×630 PNG. */
export function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test.describe("link preview images", () => {
  test("the standings name their own preview image and it is a 1200×630 PNG", async ({
    page,
    request,
  }) => {
    await page.goto("/rating");
    const url = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(url).toMatch(/\/ru\/rating\/opengraph-image/);

    const response = await request.get(new URL(url!).pathname + new URL(url!).search);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect(pngSize(await response.body())).toEqual({ width: 1200, height: 630 });
  });

  test("the English page points at the English image", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "lang", value: "en", url: baseURL! }]);
    await page.goto("/rating");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/en\/rating\/opengraph-image/,
    );
  });

  test("a participant who does not exist gets a 404 card, not a crash", async ({ request }) => {
    const response = await request.get("/ru/u/net_takogo_nika_123456/opengraph-image");
    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toContain("image/png");
  });

  test("the preview image is not redirected to a plain address", async ({ request }) => {
    const response = await request.get("/en/rating/opengraph-image", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });
});
