import { type APIRequestContext, type Page } from "@playwright/test";
import { expect, test } from "./helpers/fixtures";
import {
  createTestUser,
  deleteTestUser,
  hasAdminAccess,
  serviceClient,
  setProfile,
  signInAs,
  type TestUser,
} from "./helpers/test-user";

/**
 * The main journey of the product on the real database, from the admin building a tournament to
 * the rating after the result: tournament → clubs → season → tour → match (admin API), two
 * participants predict (UI), the admin enters the result (API), points and places appear.
 * Everything it creates is named `E2E …` / `e2e-…` and removed afterwards; leftovers of an
 * interrupted run are removed at the start of the next one.
 */
test.describe("live cycle (needs SUPABASE_SECRET_KEY)", () => {
  test.skip(!hasAdminAccess, "SUPABASE_SECRET_KEY is not set");
  test.skip(({ isMobile }) => isMobile, "one run is enough: the desktop project covers it");
  test.describe.configure({ mode: "serial" });

  const run = Math.random().toString(36).slice(2, 8);
  const tag = `e2e-${run}`;
  const homeName = `E2E Дом ${run}`;
  const awayName = `E2E Гость ${run}`;
  const pointsExact = 5;
  const pointsOutcome = 2;

  let admin: TestUser;
  let exactUser: TestUser;
  let outcomeUser: TestUser;
  const exactNick = `ex_${run}`;
  const outcomeNick = `oc_${run}`;
  const ids = { tournament: "", season: "", tour: "", match: "", homeClub: "", awayClub: "" };

  async function api<T>(
    request: APIRequestContext,
    method: "post" | "patch" | "put",
    path: string,
    data: unknown,
  ): Promise<T> {
    const response = await request[method](`/api/v1${path}`, { data });
    expect(response.status(), `${method} ${path}`).toBeLessThan(300);
    return ((await response.json()) as { data: T }).data;
  }

  /** Remove what earlier interrupted runs left behind (older than an hour), then this run's data. */
  async function removeTestData(onlyThisRun: boolean) {
    const db = serviceClient();
    const before = new Date(Date.now() - 3_600_000).toISOString();
    const tournaments = db
      .from("tournaments")
      .delete()
      .like("slug", onlyThisRun ? tag : "e2e-%");
    await (onlyThisRun ? tournaments : tournaments.lt("created_at", before));
    const clubs = db
      .from("clubs")
      .delete()
      .like("name", onlyThisRun ? `E2E %${run}` : "E2E %");
    await (onlyThisRun ? clubs : clubs.lt("created_at", before));
  }

  test.beforeAll(async () => {
    await removeTestData(false);
    admin = await createTestUser();
    exactUser = await createTestUser();
    outcomeUser = await createTestUser();
    await setProfile(admin, { nickname: `ad_${run}`, role: "admin" });
    await setProfile(exactUser, { nickname: exactNick });
    await setProfile(outcomeUser, { nickname: outcomeNick });
  });

  // The signed-in pages must satisfy the (report-only) content policy as well (D-074).
  const violations: string[] = [];
  test.beforeEach(({ page }) => {
    page.on("console", (message) => {
      if (/content security policy|[report only]/i.test(message.text()))
        violations.push(message.text());
    });
  });
  test.afterEach(() => {
    expect(violations).toEqual([]);
  });

  test.afterAll(async () => {
    await removeTestData(true);
    for (const user of [admin, exactUser, outcomeUser]) if (user) await deleteTestUser(user);
  });

  test("the admin builds a tournament with a season, a tour and a match", async ({ page }) => {
    await signInAs(page, admin, "/admin");
    await expect(page.getByRole("heading", { name: "Обзор" })).toBeVisible();
    const request = page.request;

    const tournament = await api<{ id: string }>(request, "post", "/admin/tournaments", {
      name: `E2E турнир ${run}`,
      slug: tag,
      pointsExact,
      pointsOutcome,
      isActive: true,
    });
    ids.tournament = tournament.id;
    ids.homeClub = (
      await api<{ id: string }>(request, "post", "/admin/clubs", {
        name: homeName,
        shortName: null,
        logoPath: null,
      })
    ).id;
    ids.awayClub = (
      await api<{ id: string }>(request, "post", "/admin/clubs", {
        name: awayName,
        shortName: null,
        logoPath: null,
      })
    ).id;
    ids.season = (
      await api<{ id: string }>(request, "post", "/admin/seasons", {
        tournamentId: ids.tournament,
        name: `E2E сезон ${run}`,
      })
    ).id;
    await api(request, "put", "/admin/seasons/clubs", {
      seasonId: ids.season,
      clubIds: [ids.homeClub, ids.awayClub],
    });
    ids.tour = (
      await api<{ id: string }>(request, "post", "/admin/tours", { seasonId: ids.season })
    ).id;
    ids.match = (
      await api<{ id: string }>(request, "post", "/admin/matches", {
        tourId: ids.tour,
        homeClubId: ids.homeClub,
        awayClubId: ids.awayClub,
        kickoffAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      })
    ).id;
    expect(Object.values(ids).every(Boolean)).toBe(true);
  });

  async function predict(page: Page, user: TestUser, home: number, away: number) {
    await signInAs(page, user, `/predictions?tournament=${tag}&season=${ids.season}&tour=1`);
    await expect(page.getByRole("heading", { name: "Тур 1" })).toBeVisible();
    await page.getByLabel(`Голы ${homeName}`).fill(String(home));
    await page.getByLabel(`Голы ${awayName}`).fill(String(away));
    await page.getByRole("button", { name: "Сохранить прогнозы" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Сохранено" })).toBeVisible();
  }

  test("two participants save their predictions before the deadline", async ({ page }) => {
    await predict(page, exactUser, 2, 1);
    await predict(page, outcomeUser, 1, 0);

    // The saved prediction is still there after a reload.
    await page.reload();
    await expect(page.getByLabel(`Голы ${homeName}`)).toHaveValue("1");
    await expect(page.getByLabel(`Голы ${awayName}`)).toHaveValue("0");
  });

  test("before the deadline the tour table does not show other people's predictions", async ({
    page,
  }) => {
    await page.goto(`/rating?tournament=${tag}&season=${ids.season}&tour=1`);
    await expect(page.getByText(/Прогнозы участников откроются после дедлайна тура/)).toBeVisible();
    await expect(page.getByText(exactNick)).toHaveCount(0);
    await expect(page.getByText(outcomeNick)).toHaveCount(0);
  });

  test("after the result the points follow the tournament rules and the rating is ordered", async ({
    page,
  }) => {
    await signInAs(page, admin, "/admin");
    await api(page.request, "patch", "/admin/matches", {
      id: ids.match,
      status: "finished",
      homeScore: 2,
      awayScore: 1,
    });

    // The participant with the exact score sees the tour result.
    await signInAs(page, exactUser, `/predictions?tournament=${tag}&season=${ids.season}&tour=1`);
    await expect(page.getByText("Итог тура")).toBeVisible();
    await expect(page.getByText(/точных счетов: 1/)).toBeVisible();

    // The season table: exact score (5) above the right outcome (2).
    await page.goto(`/rating?tournament=${tag}&season=${ids.season}`);
    const rows = page.getByRole("row");
    const exactRow = rows.filter({ hasText: exactNick });
    const outcomeRow = rows.filter({ hasText: outcomeNick });
    await expect(exactRow.getByRole("cell").last()).toHaveText(String(pointsExact));
    await expect(outcomeRow.getByRole("cell").last()).toHaveText(String(pointsOutcome));
    await expect(exactRow.getByRole("cell").first()).toContainText("1");
    await expect(outcomeRow.getByRole("cell").first()).toContainText("2");

    // The tour table shows both predictions.
    await page.goto(`/rating?tournament=${tag}&season=${ids.season}&tour=1`);
    await expect(page.getByRole("row").filter({ hasText: exactNick })).toContainText("2 : 1");
    await expect(page.getByRole("row").filter({ hasText: outcomeNick })).toContainText("1 : 0");
  });

  test("the public profile statistics count the graded prediction", async ({ page }) => {
    await page.goto(`/u/${exactNick}`);
    await expect(page.getByText(`E2E турнир ${run}`)).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: `E2E сезон ${run}` })).toContainText(
      String(pointsExact),
    );
  });
});
