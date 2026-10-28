import { expect, test } from "./helpers/fixtures";

test("home has title, lang, Open Graph and icons", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Да забей");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /opengraph-image/,
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /.+/);
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /icon/);
});

test("a deployed stand advertises its own address, not localhost", async ({ page, request }) => {
  test.skip(!process.env.E2E_BASE_URL, "only meaningful against a deployed stand");
  const origin = new URL(process.env.E2E_BASE_URL!).origin;

  await page.goto("/");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    new RegExp(`^${origin}`),
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    new RegExp(`^${origin}/`),
  );
  expect(await (await request.get("/sitemap.xml")).text()).toContain(`<loc>${origin}`);
});

// The home address is the site origin (Next prints it without a trailing slash).
const HOME_URL = /^https?:\/\/[^/]+\/?$/;

test("only the home page names itself in og:url; other pages do not claim the home address", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", HOME_URL);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", HOME_URL);
  await page.goto("/rating");
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
});

test("sitemap.xml and robots.txt are served", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("<loc>");

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /api/");
});

test("the landing is in the static HTML exactly once, without scripts (DAZBY-125)", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  // One copy for search engines and previews: the session check must not send a second one.
  expect(html.match(/id="landing-title"/g)).toHaveLength(1);
  expect(html.match(/id="how"/g)).toHaveLength(1);
  expect(html).toContain("когда ты в игре");
});
