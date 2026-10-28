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
  }, testInfo) => {
    const run = Math.random().toString(36).slice(2, 8);
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/content security policy|refused to/i.test(message.text()))
        violations.push(message.text());
    });
    // What the browser saw on the wire, with times: attached when the test fails, because a lost
    // message or a channel that never connects cannot be explained afterwards without it (DAZBY-130).
    const t0 = Date.now();
    const trace: string[] = [];
    const note = (line: string) => trace.push(`${Date.now() - t0} ms  ${line}`);
    page.on("websocket", (ws) => {
      ws.on("framereceived", (f) => note(`in   ${String(f.payload).slice(0, 220)}`));
      ws.on("framesent", (f) => note(`out  ${String(f.payload).slice(0, 160)}`));
      ws.on("close", () => note("socket closed"));
    });
    page.on("response", (r) => {
      if (r.url().includes("/api/v1/chat")) note(`http ${r.status()} ${r.url().slice(-24)}`);
    });
    const me: TestUser = await createTestUser();
    const other: TestUser = await createTestUser();
    try {
      await setProfile(me, { nickname: `lm_${run}` });
      await setProfile(other, { nickname: `lo_${run}` });
      await signInAs(page, me, "/chat");
      await expect(page.getByText("На связи")).toBeVisible({ timeout: 30_000 });
      note("page shows live");

      const client = await signedInClient(other);
      const { error } = await client
        .from("chat_messages")
        .insert({ user_id: other.id, body: `hello ${run}` });
      expect(error).toBeNull();
      note("other participant's insert done");
      await expect(page.getByText(`hello ${run}`)).toBeVisible({ timeout: 15_000 });
      // The author's nickname and photo lead to the player's page.
      const author = page.getByRole("link", { name: `lo_${run}` });
      await expect(author.first()).toHaveAttribute("href", `/u/lo_${run}`);

      await page.getByLabel("Ваше сообщение").fill(`mine ${run}`);
      await page.getByRole("button", { name: "Отправить" }).click();
      await expect(page.getByText(`mine ${run}`)).toBeVisible({ timeout: 15_000 });
      expect(violations).toEqual([]);
    } catch (error) {
      const body = trace.join(" || ");
      await testInfo.attach("realtime-trace", { body, contentType: "text/plain" });
      console.log(`REALTIME TRACE: ${body}`);
      throw error;
    } finally {
      await serviceClient().from("chat_messages").delete().in("user_id", [me.id, other.id]);
      await deleteTestUser(me);
      await deleteTestUser(other);
    }
  });
});
