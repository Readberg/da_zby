import { expect, test } from "./helpers/fixtures";

test.describe("predictions (guest)", () => {
  test("the page opens, is in the header and has no horizontal scroll", async ({ page }) => {
    await page.goto("/predictions");
    await expect(page.getByRole("heading", { level: 1, name: "Прогнозы" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Прогнозы" })).toBeVisible();
    // Either the pickers (a tournament exists) or the empty state: both are valid content.
    await expect(page.getByLabel("Турнир").or(page.getByText("Турниров пока нет"))).toBeVisible({
      timeout: 15_000,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("unknown parameters do not break the page", async ({ page }) => {
    const response = await page.goto("/predictions?tournament=net-takogo&season=x&tour=abc");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Прогнозы" })).toBeVisible();
  });

  test("saving predictions needs a signed-in user", async ({ request }) => {
    const response = await request.put("/api/v1/predictions", {
      data: {
        tourId: "44444444-4444-4444-8444-444444444444",
        items: [{ matchId: "55555555-5555-4555-8555-555555555555", homeScore: 1, awayScore: 0 }],
      },
    });
    expect(response.status()).toBe(401);
  });
});
