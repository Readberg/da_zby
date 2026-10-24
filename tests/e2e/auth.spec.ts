import { expect, test } from "@playwright/test";

test.describe("guest and login", () => {
  test("header offers sign-in and it leads to the login form", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Вход" })).toBeVisible();
    await expect(page.getByLabel("Почта")).toBeVisible();
  });

  test("an invalid email is rejected on the page without sending anything", async ({ page }) => {
    const authRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/v1/")) authRequests.push(request.url());
    });
    await page.goto("/login");
    await page.getByLabel("Почта").fill("not-an-email");
    await page.getByRole("button", { name: "Получить ссылку" }).click();
    await expect(page.locator("#login-email-error")).toHaveText("Введите корректную почту.");
    expect(authRequests).toEqual([]);
  });

  test("login page has no horizontal scroll and a 44px tall submit button", async ({ page }) => {
    await page.goto("/login");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    const box = await page.getByRole("button", { name: "Получить ссылку" }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
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
    await expect(page.getByLabel("Почта")).toBeVisible();
  });
});

test.describe("auth routes", () => {
  test("a callback without a code sends the guest back with an error message", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/login\?error=link$/);
    await expect(page.locator("#login-email-error")).toContainText("Ссылка недействительна");
  });

  test("a callback never leaves the site, even with a hostile next parameter", async ({ page }) => {
    await page.goto("/auth/callback?code=bad&next=https://evil.example");
    expect(new URL(page.url()).origin).toBe(new URL(process.env.E2E_BASE_URL ?? page.url()).origin);
  });

  test("sign-out cannot be triggered by a plain link (GET)", async ({ request }) => {
    const response = await request.get("/auth/signout", { maxRedirects: 0 });
    expect(response.status()).toBe(405);
  });
});
