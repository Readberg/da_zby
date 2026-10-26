import { accessibilityViolations } from "./helpers/axe";
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
 * Accessibility (WCAG 2.1 A and AA, axe-core) of the pages that need a session, with real data on
 * them: the member's home, profile, predictions and rating; the whole admin. Both themes.
 * Test data is named `E2E …` / `e2e-…` and removed afterwards (D-078).
 */
test.describe("accessibility of signed-in pages (needs SUPABASE_SECRET_KEY)", () => {
  test.skip(!hasAdminAccess, "SUPABASE_SECRET_KEY is not set");
  // Each test scans several pages (about five seconds each).
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  const run = Math.random().toString(36).slice(2, 8);
  const tag = `e2e-${run}`;
  let member: TestUser;
  let boss: TestUser;
  const ids = { season: "", tour: "" };

  test.beforeAll(async () => {
    const db = serviceClient();
    member = await createTestUser();
    boss = await createTestUser();
    await setProfile(member, { nickname: `am_${run}` });
    await setProfile(boss, { nickname: `aa_${run}`, role: "admin" });

    const insert = async <T>(table: string, row: object): Promise<T> => {
      const { data, error } = await db.from(table).insert(row).select().single();
      if (error) throw new Error(`${table}: ${error.message}`);
      return data as T;
    };
    const tournament = await insert<{ id: string }>("tournaments", {
      name: `E2E доступность ${run}`,
      slug: tag,
    });
    const season = await insert<{ id: string }>("seasons", {
      tournament_id: tournament.id,
      name: `E2E ${run}`,
    });
    const home = await insert<{ id: string }>("clubs", { name: `E2E А1 ${run}` });
    const away = await insert<{ id: string }>("clubs", { name: `E2E А2 ${run}` });
    await db.from("season_clubs").insert([
      { season_id: season.id, club_id: home.id },
      { season_id: season.id, club_id: away.id },
    ]);
    const tour = await insert<{ id: string }>("tours", { season_id: season.id, number: 1 });
    const match = await insert<{ id: string }>("matches", {
      tour_id: tour.id,
      home_club_id: home.id,
      away_club_id: away.id,
      kickoff_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    });
    await insert("predictions", {
      user_id: member.id,
      match_id: match.id,
      home_score: 1,
      away_score: 0,
    });
    ids.season = season.id;
    ids.tour = tour.id;
  });

  test.afterAll(async () => {
    const db = serviceClient();
    await db.from("tournaments").delete().eq("slug", tag);
    await db.from("clubs").delete().like("name", `E2E %${run}`);
    for (const user of [member, boss]) if (user) await deleteTestUser(user);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`the member's pages have no violations (${scheme} theme)`, async ({ page }, testInfo) => {
      // Contrast depends on the theme, not on the width: on a phone the dark theme is enough.
      test.skip(testInfo.project.name === "mobile" && scheme === "light", "covered on the desktop");
      await page.emulateMedia({ colorScheme: scheme });
      await signInAs(page, member, "/");
      for (const path of [
        "/",
        "/profile/edit",
        `/predictions?tournament=${tag}&season=${ids.season}&tour=1`,
        `/rating?tournament=${tag}&season=${ids.season}`,
      ]) {
        await page.goto(path);
        expect(await accessibilityViolations(page), path).toEqual([]);
      }
    });

    test(`the admin pages have no violations (${scheme} theme)`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "the admin is a desktop tool; one run is enough",
      );
      await page.emulateMedia({ colorScheme: scheme });
      await signInAs(page, boss, "/admin");
      for (const path of [
        "/admin/tournaments",
        "/admin/clubs",
        `/admin/seasons/${ids.season}`,
        `/admin/seasons/${ids.season}/tours/${ids.tour}`,
        "/admin/users",
      ]) {
        await page.goto(path);
        expect(await accessibilityViolations(page), path).toEqual([]);
      }
    });
  }
});
