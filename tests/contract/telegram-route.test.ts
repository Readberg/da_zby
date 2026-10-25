// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN_SECRET = "123456:TEST-token-0123456789abcdef";
const LOGIN_TOKEN = "t".repeat(43);

const verifyOtp = vi.fn();
const getUser = vi.fn();
const profileRow = vi.fn();
const consume = vi.fn();
const prepare = vi.fn();
const handle = vi.fn();
const env = vi.hoisted(() => ({
  TELEGRAM_BOT_TOKEN: undefined as string | undefined,
  SUPABASE_SECRET_KEY: undefined as string | undefined,
  TELEGRAM_ADMIN_IDS: "42" as string | undefined,
}));

vi.mock("@/lib/env.server", () => ({ serverEnv: env }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { verifyOtp, getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profileRow() }) }) }),
    }),
  }),
}));
vi.mock("@/server/services/login-tokens", async (original) => ({
  ...(await original<typeof import("@/server/services/login-tokens")>()),
  consumeLogin: (...args: unknown[]) => consume(...args),
  handleBotUpdate: (...args: unknown[]) => handle(...args),
}));
vi.mock("@/server/services/telegram-login", async (original) => ({
  ...(await original<typeof import("@/server/services/telegram-login")>()),
  prepareTelegramSession: (...args: unknown[]) => prepare(...args),
}));

const complete = await import("@/app/auth/telegram/route");
const webhook = await import("@/app/api/telegram/webhook/route");
const { webhookSecret } = await import("@/server/services/telegram-bot");

const req = (query: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000/auth/telegram?${query}`, {
    headers: cookie ? { cookie } : {},
  });
const target = (r: Response) => {
  const url = new URL(r.headers.get("location")!);
  return url.pathname + url.search;
};
const user = { id: "42", username: "roma", firstName: "Roma", lastName: null };

beforeEach(() => {
  env.TELEGRAM_BOT_TOKEN = TOKEN_SECRET;
  env.SUPABASE_SECRET_KEY = "sb_secret_x";
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  profileRow.mockReset().mockReturnValue({ nickname: "Readberg" });
  consume.mockReset().mockResolvedValue(user);
  prepare.mockReset().mockResolvedValue("token-hash");
  handle.mockReset().mockResolvedValue(undefined);
});

describe("GET /auth/telegram?token=", () => {
  it("opens a session for a confirmed token and returns to the remembered page", async () => {
    const r = await complete.GET(req(`token=${LOGIN_TOKEN}`, "login_next=%2Fprofile%2Fedit"));
    expect(consume).toHaveBeenCalledWith({}, LOGIN_TOKEN);
    expect(prepare).toHaveBeenCalledWith({}, user, ["42"]);
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "token-hash" });
    expect(target(r)).toBe("/profile/edit");
  });

  it("lands on the profile when no particular page was requested", async () => {
    expect(target(await complete.GET(req(`token=${LOGIN_TOKEN}`)))).toBe("/profile");
  });

  it("sends a new user without a nickname to onboarding", async () => {
    profileRow.mockReturnValue({ nickname: null });
    expect(target(await complete.GET(req(`token=${LOGIN_TOKEN}`)))).toBe(
      "/onboarding?next=%2Fprofile",
    );
  });

  it("never follows a hostile return path from the cookie", async () => {
    const r = await complete.GET(
      req(`token=${LOGIN_TOKEN}`, "login_next=https%3A%2F%2Fevil.example"),
    );
    expect(target(r)).toBe("/profile");
  });

  it("refuses a missing or malformed token without touching the database", async () => {
    for (const query of ["", "token=short", "token=%3Cscript%3E"]) {
      expect(target(await complete.GET(req(query)))).toBe("/login?error=telegram");
    }
    expect(consume).not.toHaveBeenCalled();
  });

  it("refuses a token that is not confirmed, expired or already used", async () => {
    consume.mockResolvedValue(null);
    expect(target(await complete.GET(req(`token=${LOGIN_TOKEN}`)))).toBe("/login?error=telegram");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("fails closed when the bot token or secret key is not configured", async () => {
    env.TELEGRAM_BOT_TOKEN = undefined;
    expect(target(await complete.GET(req(`token=${LOGIN_TOKEN}`)))).toBe("/login?error=telegram");
    env.TELEGRAM_BOT_TOKEN = TOKEN_SECRET;
    env.SUPABASE_SECRET_KEY = undefined;
    expect(target(await complete.GET(req(`token=${LOGIN_TOKEN}`)))).toBe("/login?error=telegram");
    expect(consume).not.toHaveBeenCalled();
  });

  it("fails closed when account preparation or the session exchange fails", async () => {
    prepare.mockRejectedValue(new Error("boom"));
    expect(target(await complete.GET(req(`token=${LOGIN_TOKEN}`)))).toBe("/login?error=telegram");
    prepare.mockResolvedValue("h");
    verifyOtp.mockResolvedValue({ error: { message: "bad" } });
    expect(target(await complete.GET(req(`token=${LOGIN_TOKEN}`)))).toBe("/login?error=telegram");
  });
});

describe("POST /api/telegram/webhook", () => {
  const post = (secret: string | null, body: object = { update_id: 1 }) =>
    new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: secret ? { "x-telegram-bot-api-secret-token": secret } : {},
      body: JSON.stringify(body),
    });

  it("processes updates that carry the derived secret", async () => {
    const update = { message: { chat: { id: 1 }, text: "/start" } };
    const r = await webhook.POST(post(webhookSecret(TOKEN_SECRET), update));
    expect(r.status).toBe(200);
    expect(handle).toHaveBeenCalledOnce();
    expect(handle.mock.calls[0]![2]).toEqual(update);
  });

  it("rejects requests without the secret or with a wrong one", async () => {
    expect((await webhook.POST(post(null))).status).toBe(401);
    expect((await webhook.POST(post("x".repeat(64)))).status).toBe(401);
    expect(handle).not.toHaveBeenCalled();
  });

  it("answers 503 when sign-in is not configured", async () => {
    env.TELEGRAM_BOT_TOKEN = undefined;
    expect((await webhook.POST(post(webhookSecret(TOKEN_SECRET)))).status).toBe(503);
  });

  it("still answers 200 when processing fails, so Telegram does not retry forever", async () => {
    handle.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await webhook.POST(post(webhookSecret(TOKEN_SECRET)))).status).toBe(200);
    spy.mockRestore();
  });
});
