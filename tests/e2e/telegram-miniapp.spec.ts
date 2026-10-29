import { expect, test } from "./helpers/fixtures";

/**
 * The site as a Telegram Mini App (D-128). Real Telegram cannot be opened here, so the page gets a
 * stand-in for `window.Telegram.WebApp` before it loads; what is checked is what the site does with
 * it. Signing in with real launch data is covered by the unit and contract tests (it needs the bot
 * token) and, on a phone, by the owner.
 */
const STUB = `
  window.__tma = { calls: [] };
  const note = (name) => (...args) => window.__tma.calls.push([name, ...args]);
  window.Telegram = {
    WebApp: {
      initData: "query_id=AAH&user=%7B%22id%22%3A1%7D&auth_date=1&hash=deadbeef",
      initDataUnsafe: { user: { language_code: "ru" } },
      ready: note("ready"),
      expand: note("expand"),
      setHeaderColor: note("setHeaderColor"),
      setBackgroundColor: note("setBackgroundColor"),
      setBottomBarColor: note("setBottomBarColor"),
      disableVerticalSwipes: note("disableVerticalSwipes"),
      openLink: note("openLink"),
      openTelegramLink: note("openTelegramLink"),
      BackButton: { show: note("back.show"), hide: note("back.hide"), onClick: note("back.onClick"), offClick: note("back.offClick") },
    },
  };
`;

const calls = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __tma: { calls: unknown[][] } }).__tma.calls);

test.describe("an ordinary visitor", () => {
  test("never loads Telegram's script and the page is not in Mini App mode", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    expect(requested.filter((url) => url.includes("telegram.org"))).toEqual([]);
    await expect(page.locator("html")).not.toHaveClass(/tma/);
  });
});

test.describe("inside Telegram", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(STUB);
  });

  test("opens full height, paints the bars and tries to sign in once", async ({ page }) => {
    const signIn = page.waitForRequest((r) => r.url().includes("/api/v1/auth/telegram/miniapp"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/tma/);
    await expect.poll(async () => (await calls(page)).map((c) => c[0])).toContain("expand");
    expect(await calls(page)).toEqual(
      expect.arrayContaining([
        ["ready"],
        ["expand"],
        ["setHeaderColor", "#090909"],
        ["setBackgroundColor", "#090909"],
      ]),
    );
    // The stand-in's data is not signed by Telegram: the server must refuse it (401, or 503 when
    // the bot is not configured), and the page must stay as it is, not reload again and again.
    const response = await (await signIn).response();
    expect([401, 503]).toContain(response?.status());
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("shows Telegram's Back button on an inner page only", async ({ page }) => {
    await page.goto("/");
    await expect.poll(async () => (await calls(page)).map((c) => c[0])).toContain("back.hide");

    await page.goto("/rating");
    await expect.poll(async () => (await calls(page)).map((c) => c[0])).toContain("back.show");
  });

  test("hands links to other sites to Telegram instead of opening a tab", async ({ page }) => {
    await page.goto("/");
    await expect.poll(async () => (await calls(page)).map((c) => c[0])).toContain("ready");
    const youtube = page.getByRole("contentinfo").getByRole("link", { name: /YouTube/ });
    const before = page.url();
    await youtube.click();
    await expect
      .poll(async () => (await calls(page)).find((c) => c[0] === "openLink"))
      .toEqual(["openLink", expect.stringContaining("youtube.com")]);
    expect(page.url()).toBe(before);
    expect(page.context().pages()).toHaveLength(1);
  });

  test("has no content policy violation from the Mini App parts", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/content security policy|refused to/i.test(message.text()))
        violations.push(message.text());
    });
    await page.goto("/rating");
    await expect.poll(async () => (await calls(page)).map((c) => c[0])).toContain("back.show");
    expect(violations).toEqual([]);
  });
});
