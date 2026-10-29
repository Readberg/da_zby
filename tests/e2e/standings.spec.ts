import { expect, openMenu, test } from "./helpers/fixtures";

test.describe("league table (guest, DAZBY-126)", () => {
  test("the page opens, is in the header and has no horizontal scroll", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/standings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Турнирная таблица чемпионата" }),
    ).toBeVisible();
    await openMenu(page);
    await expect(page.getByRole("banner").getByRole("link", { name: "Таблица" })).toBeVisible();
    // Either the table (a season exists) or an empty state: both are valid content.
    await expect(
      page
        .getByRole("table", { name: "Турнирная таблица чемпионата" })
        .or(page.getByText("Турниров пока нет"))
        .or(page.getByText("В этом сезоне пока нет клубов"))
        .or(page.getByText("В этом турнире пока нет сезонов")),
    ).toBeVisible({ timeout: 15_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    expect(errors).toEqual([]);
  });

  test("the table says how many matches it counts", async ({ page }) => {
    await page.goto("/standings");
    const table = page.getByRole("table", { name: "Турнирная таблица чемпионата" });
    test.skip((await table.count()) === 0, "no season with clubs on this stand");
    await expect(page.getByText(/Учтено матчей: \d+ из \d+/)).toBeVisible();
    // When the table was last recalculated, and how often it is.
    await expect(page.getByText(/Обновлено: .+\.|Результатов матчей пока нет\./)).toBeVisible();
    await expect(page.getByText(/через 20 минут после окончания матчей/)).toBeVisible();
  });

  test("unknown parameters do not break the page", async ({ page }) => {
    const response = await page.goto("/standings?tournament=net-takogo&season=x");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Турнирная таблица чемпионата" }),
    ).toBeVisible();
  });
});
