import { expect, test } from "./helpers/fixtures";
import {
  createTestUser,
  deleteTestUser,
  hasAdminAccess,
  serviceClient,
  setProfile,
  signInAs,
  signedInClient,
  type TestUser,
} from "./helpers/test-user";

/**
 * The chat is live (DAZBY-128): a message of another participant arrives without a reload. It broke
 * silently when the channel joined before the session token was set (Realtime answered 401).
 */
test.describe("live chat (needs SUPABASE_SECRET_KEY)", () => {
  test.skip(!hasAdminAccess, "SUPABASE_SECRET_KEY is not set");
  test.skip(({ isMobile }) => isMobile, "one run is enough");

  test("a message of another participant arrives without a reload, and my own is shown", async ({
    page,
  }) => {
    const run = Math.random().toString(36).slice(2, 8);
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/content security policy|refused to/i.test(message.text()))
        violations.push(message.text());
    });
    const me: TestUser = await createTestUser();
    const other: TestUser = await createTestUser();
    try {
      await setProfile(me, { nickname: `lm_${run}` });
      await setProfile(other, { nickname: `lo_${run}` });
      await signInAs(page, me, "/chat");
      await expect(page.getByText("На связи")).toBeVisible({ timeout: 20_000 });

      const client = await signedInClient(other);
      const { error } = await client
        .from("chat_messages")
        .insert({ user_id: other.id, body: `hello ${run}` });
      expect(error).toBeNull();
      await expect(page.getByText(`hello ${run}`)).toBeVisible({ timeout: 15_000 });

      await page.getByLabel("Ваше сообщение").fill(`mine ${run}`);
      await page.getByRole("button", { name: "Отправить" }).click();
      await expect(page.getByText(`mine ${run}`)).toBeVisible({ timeout: 15_000 });
      expect(violations).toEqual([]);
    } finally {
      await serviceClient().from("chat_messages").delete().in("user_id", [me.id, other.id]);
      await deleteTestUser(me);
      await deleteTestUser(other);
    }
  });
});
