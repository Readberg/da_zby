import { expect, test } from "./helpers/fixtures";

test.describe("guest and login", () => {
  test("header offers sign-in and it leads to the login page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Вход" })).toBeVisible();
  });

  test("login page offers no email or password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Вход" })).toBeVisible();
    await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(0);
  });

  test("login page has no horizontal scroll", async ({ page }) => {
    await page.goto("/login");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("login page is not indexed", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("onboarding", () => {
  test("a guest is sent to login and brought back to onboarding afterwards", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/);
    await expect(page.getByRole("heading", { level: 1, name: "Вход" })).toBeVisible();
  });
});

test.describe("profile pages", () => {
  test("a guest on /profile is sent to login and returns after signing in", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
  });

  test("an unknown nickname shows the not-found page", async ({ page }) => {
    // The profile streams in behind a Suspense boundary, so the HTTP status is already 200 when
    // the lookup fails (D-052); the visitor still gets the regular not-found page.
    await page.goto("/u/net_takogo_nika_123456");
    await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
  });
});

test.describe("auth routes", () => {
  test("Telegram data without a valid signature sends the guest back with an error", async ({
    page,
  }) => {
    await page.goto("/auth/telegram?id=1&auth_date=1&hash=00");
    await expect(page).toHaveURL(/\/login\?error=telegram$/);
    await expect(page.locator("#login-error")).toContainText("Не удалось войти через Telegram");
  });

  test("a forged Telegram request never leaves the site", async ({ page }) => {
    await page.goto("/auth/telegram?id=1&auth_date=1&hash=00&next=https://evil.example");
    expect(new URL(page.url()).origin).toBe(new URL(process.env.E2E_BASE_URL ?? page.url()).origin);
  });

  test("sign-out cannot be triggered by a plain link (GET)", async ({ request }) => {
    const response = await request.get("/auth/signout", { maxRedirects: 0 });
    expect(response.status()).toBe(405);
  });
});

test.describe("admin area", () => {
  test("a guest is sent to login and brought back to the admin area", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  });

  test("the admin API is closed to guests", async ({ request }) => {
    expect((await request.get("/api/v1/admin/users")).status()).toBe(401);
    const patch = await request.patch("/api/v1/admin/users/role", {
      data: { userId: "11111111-1111-4111-8111-111111111111", role: "admin" },
    });
    expect(patch.status()).toBe(401);
  });
});

test.describe("admin catalog", () => {
  test("a guest is sent to login from the tournaments and clubs pages", async ({ page }) => {
    await page.goto("/admin/tournaments");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    await page.goto("/admin/clubs");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  });

  test("the catalog API is closed to guests", async ({ request }) => {
    expect((await request.get("/api/v1/admin/tournaments")).status()).toBe(401);
    expect((await request.get("/api/v1/admin/clubs")).status()).toBe(401);
  });
});

test.describe("admin seasons and matches", () => {
  test("a guest is sent to login from the seasons pages", async ({ page }) => {
    await page.goto("/admin/seasons");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    await page.goto("/admin/seasons/11111111-1111-4111-8111-111111111111");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  });

  test("the seasons, tours and matches API is closed to guests", async ({ request }) => {
    expect((await request.get("/api/v1/admin/seasons")).status()).toBe(401);
    expect(
      (
        await request.get("/api/v1/admin/tour?tourId=44444444-4444-4444-8444-444444444444")
      ).status(),
    ).toBe(401);
    const result = await request.patch("/api/v1/admin/matches", {
      data: {
        id: "55555555-5555-4555-8555-555555555555",
        status: "finished",
        homeScore: 1,
        awayScore: 0,
      },
    });
    expect(result.status()).toBe(401);
  });
});
