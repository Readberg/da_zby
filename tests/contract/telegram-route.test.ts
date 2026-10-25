// @vitest-environment node
import { createHash, createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "123456:TEST-token-0123456789abcdef";

const verifyOtp = vi.fn();
const getUser = vi.fn();
const profileRow = vi.fn();
const prepare = vi.fn();
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
vi.mock("@/server/services/telegram-login", async (original) => ({
  ...(await original<typeof import("@/server/services/telegram-login")>()),
  prepareTelegramSession: (...args: unknown[]) => prepare(...args),
}));

const route = await import("@/app/auth/telegram/route");

function signedQuery(fields: Record<string, string>) {
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const hash = createHmac("sha256", createHash("sha256").update(TOKEN).digest())
    .update(check)
    .digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
const fresh = () => ({
  id: "42",
  first_name: "Роман",
  auth_date: String(Math.floor(Date.now() / 1000)),
});
const req = (query: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000/auth/telegram?${query}`, {
    headers: cookie ? { cookie } : {},
  });
const target = (r: Response) => {
  const url = new URL(r.headers.get("location")!);
  return url.pathname + url.search;
};

beforeEach(() => {
  env.TELEGRAM_BOT_TOKEN = TOKEN;
  env.SUPABASE_SECRET_KEY = "sb_secret_x";
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  profileRow.mockReset().mockReturnValue({ nickname: "Readberg" });
  prepare.mockReset().mockResolvedValue("token-hash");
});

describe("GET /auth/telegram", () => {
  it("opens a session for a correctly signed request and returns to the remembered page", async () => {
    const r = await route.GET(req(signedQuery(fresh()), "login_next=%2Fprofile"));
    expect(prepare).toHaveBeenCalledWith({}, expect.objectContaining({ id: "42" }), ["42"]);
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "token-hash" });
    expect(target(r)).toBe("/profile");
  });

  it("sends a new user without a nickname to onboarding", async () => {
    profileRow.mockReturnValue({ nickname: null });
    const r = await route.GET(req(signedQuery(fresh())));
    expect(target(r)).toBe("/onboarding?next=%2F");
  });

  it("never follows a hostile return path from the cookie", async () => {
    const r = await route.GET(req(signedQuery(fresh()), "login_next=https%3A%2F%2Fevil.example"));
    expect(target(r)).toBe("/");
  });

  it("refuses a forged signature without touching accounts", async () => {
    const query = signedQuery(fresh()).replace("id=42", "id=43");
    const r = await route.GET(req(query));
    expect(prepare).not.toHaveBeenCalled();
    expect(target(r)).toBe("/login?error=telegram");
  });

  it("refuses an old confirmation", async () => {
    const old = { ...fresh(), auth_date: String(Math.floor(Date.now() / 1000) - 7200) };
    const r = await route.GET(req(signedQuery(old)));
    expect(prepare).not.toHaveBeenCalled();
    expect(target(r)).toBe("/login?error=telegram");
  });

  it("fails closed when the bot token or secret key is not configured", async () => {
    env.TELEGRAM_BOT_TOKEN = undefined;
    expect(target(await route.GET(req(signedQuery(fresh()))))).toBe("/login?error=telegram");
    env.TELEGRAM_BOT_TOKEN = TOKEN;
    env.SUPABASE_SECRET_KEY = undefined;
    expect(target(await route.GET(req(signedQuery(fresh()))))).toBe("/login?error=telegram");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("fails closed when account preparation or the session exchange fails", async () => {
    prepare.mockRejectedValue(new Error("boom"));
    expect(target(await route.GET(req(signedQuery(fresh()))))).toBe("/login?error=telegram");
    prepare.mockResolvedValue("h");
    verifyOtp.mockResolvedValue({ error: { message: "bad" } });
    expect(target(await route.GET(req(signedQuery(fresh()))))).toBe("/login?error=telegram");
  });
});
