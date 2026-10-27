// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatListSchema, chatMessageSchema } from "@/server/api/v1/schemas/chat";
import { apiRequest, expectApiHeaders, expectProblem } from "./helpers";

const createClient = vi.fn();
const listChat = vi.fn();
const sendChatMessage = vi.fn();
const deleteChatMessage = vi.fn();
const setChatBan = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/server/services/chat", () => ({
  listChat,
  sendChatMessage,
  deleteChatMessage,
  setChatBan,
}));

const chat = await import("@/app/api/v1/chat/route");
const bans = await import("@/app/api/v1/admin/chat/bans/route");

const USER = "99999999-9999-4999-8999-999999999999";
const MESSAGE = "11111111-1111-4111-8111-111111111111";
const message = {
  id: MESSAGE,
  userId: USER,
  nickname: "user1",
  avatarPath: null,
  body: "hello",
  createdAt: "2026-10-27T10:00:00.000Z",
};

function client(role: "guest" | "user" | "admin") {
  createClient.mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: role === "guest" ? null : { id: USER } },
        error: null,
      })),
    },
    rpc: vi.fn(async () => ({ data: role === "admin", error: null })),
  });
}

const json = (path: string, method: string, body: unknown) =>
  apiRequest(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  listChat.mockReset().mockResolvedValue({ messages: [message], banned: false });
  sendChatMessage.mockReset().mockResolvedValue(message);
  deleteChatMessage.mockReset().mockResolvedValue({ id: MESSAGE });
  setChatBan.mockReset().mockResolvedValue({ userId: USER, banned: true });
});

describe("/api/v1/chat", () => {
  it("is closed to guests on every method", async () => {
    client("guest");
    await expectProblem(await chat.GET(apiRequest("/api/v1/chat")), 401, "auth.required");
    await expectProblem(
      await chat.POST(json("/api/v1/chat", "POST", { body: "hi" })),
      401,
      "auth.required",
    );
    await expectProblem(
      await chat.DELETE(json("/api/v1/chat", "DELETE", { id: MESSAGE })),
      401,
      "auth.required",
    );
    expect(listChat).not.toHaveBeenCalled();
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it("lists messages for a signed-in user, never cached", async () => {
    client("user");
    const response = await chat.GET(apiRequest("/api/v1/chat"));
    expectApiHeaders(response);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(chatListSchema.parse((await response.json()).data).messages).toHaveLength(1);
    expect(listChat).toHaveBeenCalledWith(expect.anything(), USER);
  });

  it("sends as the caller, ignoring a user id in the body", async () => {
    client("user");
    const response = await chat.POST(
      json("/api/v1/chat", "POST", { body: "  hello  ", userId: "x" }),
    );
    expect(chatMessageSchema.parse((await response.json()).data).body).toBe("hello");
    expect(sendChatMessage).toHaveBeenCalledWith(expect.anything(), USER, { body: "hello" });
  });

  it.each([
    ["an empty message", { body: "   " }],
    ["a message over 500 characters", { body: "a".repeat(501) }],
    ["no body", {}],
  ])("rejects %s with 422", async (_name, body) => {
    client("user");
    await expectProblem(
      await chat.POST(json("/api/v1/chat", "POST", body)),
      422,
      "api.validation_failed",
    );
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it("deletes by id and validates the id", async () => {
    client("user");
    const ok = await chat.DELETE(json("/api/v1/chat", "DELETE", { id: MESSAGE }));
    expect((await ok.json()).data).toEqual({ id: MESSAGE });
    await expectProblem(
      await chat.DELETE(json("/api/v1/chat", "DELETE", { id: "nope" })),
      422,
      "api.validation_failed",
    );
  });
});

describe("PUT /api/v1/admin/chat/bans", () => {
  const body = { userId: USER, banned: true };

  it("is closed to guests and to ordinary users", async () => {
    client("guest");
    await expectProblem(
      await bans.PUT(json("/api/v1/admin/chat/bans", "PUT", body)),
      401,
      "auth.required",
    );
    client("user");
    await expectProblem(
      await bans.PUT(json("/api/v1/admin/chat/bans", "PUT", body)),
      403,
      "auth.forbidden",
    );
    expect(setChatBan).not.toHaveBeenCalled();
  });

  it("bans for an admin", async () => {
    client("admin");
    const response = await bans.PUT(json("/api/v1/admin/chat/bans", "PUT", body));
    expect((await response.json()).data).toEqual({ userId: USER, banned: true });
    expect(setChatBan).toHaveBeenCalledWith(expect.anything(), USER, body);
  });
});
