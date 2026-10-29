// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ApiError } from "@/server/api/v1/problem";
import { deleteChatMessage, listChat, sendChatMessage, setChatBan } from "./chat";
import { fakeDb } from "./fake-db";

const USER = "99999999-9999-4999-8999-999999999999";
const row = (n: number, minutesAgo: number) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  user_id: USER,
  author_nickname: `user${n}`,
  author_avatar_path: null,
  body: `message ${n}`,
  created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
});

describe("listChat", () => {
  it("asks only for the last 3 days and returns them oldest first", async () => {
    const { db, calls } = fakeDb(
      { chat_messages: { data: [row(2, 1), row(1, 5)] } },
      { chat_is_banned: { data: false } },
    );
    const result = await listChat(db, USER);

    expect(result.messages.map((m) => m.nickname)).toEqual(["user1", "user2"]);
    expect(result.banned).toBe(false);
    const since = calls.chat_messages!.find((c) => c.method === "gt")!.args[1] as string;
    const ageHours = (Date.now() - new Date(since).getTime()) / 3_600_000;
    expect(ageHours).toBeGreaterThan(71.99);
    expect(ageHours).toBeLessThan(72.01);
  });

  it("reports a ban", async () => {
    const { db } = fakeDb({ chat_messages: { data: [] } }, { chat_is_banned: { data: true } });
    expect((await listChat(db, USER)).banned).toBe(true);
  });
});

describe("sendChatMessage", () => {
  it("stores the text as the caller and returns the message", async () => {
    const { db, payload } = fakeDb({ chat_messages: { data: [row(1, 0)] } });
    const message = await sendChatMessage(db, USER, { body: "hello" });
    expect(payload("chat_messages", "insert")).toEqual({ user_id: USER, body: "hello" });
    expect(message.nickname).toBe("user1");
  });

  it.each([
    ["chat.banned", 403, "chat.banned"],
    ["chat.no_nickname", 409, "chat.no_nickname"],
    ["chat.rate_limited", 429, "api.too_many_requests"],
  ])("turns the database refusal %s into %i", async (message, status, code) => {
    const { db } = fakeDb({ chat_messages: { writeError: { code: "P0001", message } } });
    const error = await sendChatMessage(db, USER, { body: "hi" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
  });

  it("does not hide unexpected errors", async () => {
    const { db } = fakeDb({ chat_messages: { writeError: { message: "boom" } } });
    await expect(sendChatMessage(db, USER, { body: "hi" })).rejects.toMatchObject({
      message: "boom",
    });
  });
});

describe("deleteChatMessage", () => {
  it("deletes a message the caller may delete", async () => {
    const { db } = fakeDb({ chat_messages: { data: [{ id: row(1, 1).id }] } });
    expect(await deleteChatMessage(db, row(1, 1).id)).toEqual({ id: row(1, 1).id });
  });

  it("is a 404 when nothing was deleted (not the caller's or already gone)", async () => {
    const { db } = fakeDb({ chat_messages: { data: [] } });
    await expect(deleteChatMessage(db, row(1, 1).id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("setChatBan", () => {
  it("bans and unbans", async () => {
    const ban = fakeDb({ profiles: { data: [{ id: USER }] }, chat_bans: { data: [] } });
    expect(await setChatBan(ban.db, "admin", { userId: USER, banned: true })).toEqual({
      userId: USER,
      banned: true,
    });
    expect(ban.payload("chat_bans", "upsert")).toEqual({ user_id: USER, banned_by: "admin" });

    const unban = fakeDb({ profiles: { data: [{ id: USER }] }, chat_bans: { data: [] } });
    await setChatBan(unban.db, "admin", { userId: USER, banned: false });
    expect(unban.calls.chat_bans!.some((c) => c.method === "delete")).toBe(true);
  });

  it("is a 404 for an unknown user", async () => {
    const none = fakeDb({ profiles: { data: [] } });
    await expect(
      setChatBan(none.db, "admin", { userId: USER, banned: true }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
