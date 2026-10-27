import { expect, test } from "@playwright/test";

/** The common chat is for signed-in users only (D-098); the live part needs a real session. */
test("a guest is sent to sign in and the chat API is closed", async ({ page, request }) => {
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/login\?next=%2Fchat/);

  const response = await request.get("/api/v1/chat");
  expect(response.status()).toBe(401);
  expect((await response.json()).code).toBe("auth.required");

  // …and sees no chat window on the other pages either.
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Открыть чат" })).toHaveCount(0);

  const post = await request.post("/api/v1/chat", { data: { body: "hi" } });
  expect(post.status()).toBe(401);
});
