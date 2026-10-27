import { expect, test } from "./helpers/fixtures";

// Former manual test cases of DAZBY-14, 17, 18, 19, 20, 22.

test("guest pages make no requests to Supabase", async ({ page }) => {
  const supabaseRequests: string[] = [];
  page.on("request", (request) => {
    // Requests to Supabase itself; club logos go through the site's own /_next/image address.
    if (new URL(request.url()).hostname.endsWith("supabase.co"))
      supabaseRequests.push(request.url());
  });
  await page.goto("/");
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);
  expect(supabaseRequests).toEqual([]);
});

test("client JavaScript contains no server secrets", async ({ page, request }) => {
  const scripts: string[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith(".js")) scripts.push(response.url());
  });
  await page.goto("/");
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);
  for (const url of scripts) {
    const source = await (await request.get(url)).text();
    expect(source, url).not.toMatch(/sb_secret_[\w-]{20,}|SUPABASE_SECRET_KEY/);
  }
});

test("headings use the condensed Cyrillic display font in caps", async ({ page }) => {
  await page.goto("/");
  // The streamed home swaps its static copy for the final one: measure the final h1.
  await expect(page.locator("h1")).toHaveCount(1);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  const style = await heading.evaluate((el) => {
    const css = getComputedStyle(el);
    return { family: css.fontFamily, transform: css.textTransform };
  });
  expect(style.family).toMatch(/Oswald/i);
  expect(style.transform).toBe("uppercase");
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('700 16px "Oswald"', "Да забей");
  });
  expect(loaded).toBe(true);
});

test("header and footer controls are at least 44 px tall", async ({ page }) => {
  await page.goto("/");
  const targets = page.locator("header a, footer a");
  const count = await targets.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await targets.nth(i).boundingBox();
    expect(box?.height ?? 0, await targets.nth(i).innerText()).toBeGreaterThanOrEqual(44);
  }
});

test("keyboard focus is clearly visible", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const css = el ? getComputedStyle(el) : null;
    return { tag: el?.tagName, style: css?.outlineStyle, width: css?.outlineWidth };
  });
  expect(outline.tag).toBe("A");
  expect(outline.style).not.toBe("none");
  expect(parseFloat(outline.width ?? "0")).toBeGreaterThanOrEqual(2);
});

test("content column is narrow and centred on the desktop (D-099)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop layout only");
  await page.goto("/");
  const box = await page.locator("main > div > div").first().boundingBox();
  const viewportWidth = page.viewportSize()!.width;
  expect(box?.width ?? 0).toBeLessThan(viewportWidth);
  expect(box?.width ?? 0).toBeLessThanOrEqual(960);
  const viewport = page.viewportSize()!;
  const left = box!.x;
  const right = viewport.width - (box!.x + box!.width);
  expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
});

test("home with videos has no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  // Streaming keeps the static copy next to the final one until the swap.
  await expect(page.locator("h1")).toHaveCount(1);
  // The embed is put on the page when it is about to be seen (DAZBY-112): scroll to the video like a visitor,
  // again and again because the videos stream in after the first paint.
  await expect(async () => {
    await page.evaluate(() =>
      document.querySelector("#current-video-title")?.scrollIntoView({ block: "center" }),
    );
    await expect(
      page
        .locator('iframe[title^="Видеоплеер YouTube"]')
        .or(page.getByRole("link", { name: /Перейти на канал/ })),
    ).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

for (const path of ["/", "/predictions", "/rating", "/login"]) {
  test(`nothing sticks out of the screen on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("load");
    const viewport = page.viewportSize()!;
    const outside = await page.evaluate((width) => {
      return [...document.querySelectorAll("main *")]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          // Wide tables scroll inside their own frame on purpose.
          return (
            box.width > 0 &&
            (box.right > width + 1 || box.left < -1) &&
            !element.closest("[class*='overflow-x-auto']")
          );
        })
        .map(
          (element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 50)}`,
        );
    }, viewport.width);
    expect(outside).toEqual([]);
  });
}

test("styleguide is hidden in production", async ({ request }) => {
  test.skip(
    !process.env.CI && !process.env.E2E_BASE_URL,
    "production build only (CI or a deployed stand); the local dev server shows it",
  );
  expect((await request.get("/styleguide")).status()).toBe(404);
});
