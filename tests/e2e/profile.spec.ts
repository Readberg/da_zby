import { expect, test } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  hasAdminAccess,
  signInAs,
  type TestUser,
} from "./helpers/test-user";

test.describe("signed-in flow (needs SUPABASE_SECRET_KEY)", () => {
  test.skip(!hasAdminAccess, "SUPABASE_SECRET_KEY is not set");
  test.describe.configure({ mode: "serial" });

  let user: TestUser;
  const nickname = `e2e_${Math.random().toString(36).slice(2, 8)}`;

  test.beforeAll(async () => {
    user = await createTestUser();
  });
  test.afterAll(async () => {
    if (user) await deleteTestUser(user);
  });

  test("a new user is sent to onboarding, picks a nickname and sees the profile", async ({
    page,
  }) => {
    await signInAs(page, user, "/profile");
    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByLabel("Ник").fill(nickname);
    await expect(page.getByText("Ник свободен")).toBeVisible();
    await page.getByRole("button", { name: "Продолжить" }).click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByRole("heading", { level: 1, name: nickname })).toBeVisible();
    await expect(page.getByRole("link", { name: "Редактировать" })).toBeVisible();
  });

  test("profile edits are saved and the public page shows them without private data", async ({
    page,
  }) => {
    await signInAs(page, user, "/profile/edit");
    await page.getByLabel("О себе").fill("Люблю белорусский футбол");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Сохранено")).toBeVisible();

    await page.goto(`/u/${nickname}`);
    await expect(page.getByText("Люблю белорусский футбол")).toBeVisible();
    await expect(page.getByText(user.email)).toHaveCount(0);
  });
});
