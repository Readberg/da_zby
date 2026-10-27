import { expect, test } from "./helpers/fixtures";
import { solidPng } from "./helpers/png";
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
 * The signed-in pages that load or upload files must work under the content security policy (D-074):
 * the profile with a photo upload and the admin catalogue with a club logo upload (browser-side
 * image processing, object URLs, direct upload to storage). Any policy message is a failure.
 */
test.describe("content policy on signed-in pages (needs SUPABASE_SECRET_KEY)", () => {
  test.skip(!hasAdminAccess, "SUPABASE_SECRET_KEY is not set");
  test.skip(({ isMobile }) => isMobile, "one run is enough");
  test.describe.configure({ mode: "serial" });

  const run = Math.random().toString(36).slice(2, 8);
  let member: TestUser;
  let boss: TestUser;
  const violations: string[] = [];

  test.beforeEach(({ page }) => {
    page.on("console", (message) => {
      if (/content security policy|\[report only\]|refused to/i.test(message.text()))
        violations.push(message.text());
    });
  });
  test.afterEach(() => {
    expect(violations).toEqual([]);
  });

  test.beforeAll(async () => {
    member = await createTestUser();
    boss = await createTestUser();
    await setProfile(member, { nickname: `cm_${run}` });
    await setProfile(boss, { nickname: `ca_${run}`, role: "admin" });
  });

  test.afterAll(async () => {
    const db = serviceClient();
    const { data: logos } = await db
      .from("clubs")
      .select("logo_path")
      .like("name", `E2E CSP ${run}`);
    const paths = (logos ?? [])
      .map((club) => club.logo_path)
      .filter((p): p is string => Boolean(p));
    if (paths.length) await db.storage.from("club-logos").remove(paths);
    await db.from("clubs").delete().like("name", `E2E CSP ${run}`);
    for (const user of [member, boss]) {
      if (!user) continue;
      const { data: files } = await db.storage.from("avatars").list(user.id);
      if (files?.length)
        await db.storage.from("avatars").remove(files.map((file) => `${user.id}/${file.name}`));
      await deleteTestUser(user);
    }
  });

  test("the profile and a photo upload work", async ({ page }) => {
    await signInAs(page, member, "/profile");
    await expect(page.getByRole("heading", { level: 1, name: `cm_${run}` })).toBeVisible();
    await page.goto("/profile/edit");
    // A file chosen before the page has hydrated is lost, so choose again until the upload starts.
    await expect(async () => {
      await page
        .getByLabel("Выбрать фото")
        .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: solidPng(128) });
      await expect(page.getByRole("button", { name: "Удалить фото" })).toBeVisible({
        timeout: 3_000,
      });
    }).toPass({ timeout: 20_000 });
    await page.goto("/profile");
    // The photo on the page, not the logo of the first-visit cover.
    await expect(page.locator("main img").first()).toBeVisible();
  });

  test("the admin pages and a club logo upload work", async ({ page }) => {
    await signInAs(page, boss, "/admin");
    for (const path of ["/admin/tournaments", "/admin/seasons", "/admin/users", "/admin/clubs"]) {
      await page.goto(path);
      await expect(
        page
          .getByRole("heading", { level: 1 })
          .or(page.getByRole("heading", { level: 2 }))
          .first(),
      ).toBeVisible();
    }
    await page.getByLabel("Название").first().fill(`E2E CSP ${run}`);
    // A file chosen before the page has hydrated is lost, so choose again until the upload starts.
    await expect(async () => {
      await page
        .getByLabel("Выбрать логотип")
        .first()
        .setInputFiles({
          name: "logo.png",
          mimeType: "image/png",
          buffer: solidPng(256, [20, 20, 20]),
        });
      await expect(page.getByRole("button", { name: "Заменить логотип" }).first()).toBeVisible({
        timeout: 3_000,
      });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("button", { name: "Добавить клуб" }).click();
    // The new club shows up as a card whose name is an input value.
    await expect
      .poll(() =>
        page
          .locator("input")
          .evaluateAll(
            (inputs, name) => inputs.some((input) => (input as HTMLInputElement).value === name),
            `E2E CSP ${run}`,
          ),
      )
      .toBe(true);
  });
});
