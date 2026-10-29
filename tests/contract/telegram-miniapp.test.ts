// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/rate-limit";
import { telegramMiniAppSchema } from "@/server/api/v1/schemas/auth";
import { signInitData } from "@/server/services/telegram-miniapp";
import { apiRequest, expectApiHeaders, expectProblem } from "./helpers";

const BOT = "123456:TEST-token-0123456789abcdef";
const verifyOtp = vi.fn();
const prepare = vi.fn();
const env = vi.hoisted(() => ({
  TELEGRAM_BOT_TOKEN: undefined as string | undefined,
  SUPABASE_SECRET_KEY: undefined as string | undefined,
  TELEGRAM_ADMIN_IDS: "42" as string | undefined,
}));

vi.mock("@/lib/env.server", () => ({ serverEnv: env }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ marker: "admin" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}));
vi.mock("@/server/services/telegram-login", async (original) => ({
  ...(await original<typeof import("@/server/services/telegram-login")>()),
  prepareTelegramSession: (...args: unknown[]) => prepare(...args),
}));

const route = await import("@/app/api/v1/auth/telegram/miniapp/route");

const launch = (over: Record<string, string> = {}, token = BOT) =>
  signInitData(
    {
      query_id: "AAH-test",
      user: JSON.stringify({ id: 4242, first_name: "Роман", username: "readberg" }),
      auth_date: String(Math.floor(Date.now() / 1000) - 30),
      ...over,
    },
    token,
  );

const call = (initData: string, ip = "203.0.113.5") =>
  route.POST(
    apiRequest("/api/v1/auth/telegram/miniapp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ initData }),
    }),
  );

beforeEach(() => {
  resetRateLimits();
  env.TELEGRAM_BOT_TOKEN = BOT;
  env.SUPABASE_SECRET_KEY = "sb_secret_x";
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  prepare.mockReset().mockResolvedValue("hashed-token");
});

describe("POST /api/v1/auth/telegram/miniapp", () => {
  it("opens a session for the Telegram user that the signed data names", async () => {
    const response = await call(launch());
    expect(response.status).toBe(200);
    expectApiHeaders(response);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(telegramMiniAppSchema.parse((await response.json()).data)).toEqual({ signedIn: true });
    expect(prepare).toHaveBeenCalledWith(
      { marker: "admin" },
      { id: "4242", username: "readberg", firstName: "Роман", lastName: null },
      ["42"],
    );
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "hashed-token" });
  });

  it("answers 503 when Telegram sign-in is not configured", async () => {
    env.TELEGRAM_BOT_TOKEN = undefined;
    await expectProblem(await call(launch()), 503, "auth.telegram_unavailable");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("answers 401 to data signed with another token, changed data or an old launch", async () => {
    const otherBot = launch({}, "999:other-token-0123456789abc");
    await expectProblem(await call(otherBot), 401, "auth.required");

    const changed = new URLSearchParams(launch());
    changed.set("user", JSON.stringify({ id: 1 }));
    await expectProblem(await call(changed.toString()), 401, "auth.required");

    const old = launch({ auth_date: String(Math.floor(Date.now() / 1000) - 7200) });
    await expectProblem(await call(old), 401, "auth.required");

    expect(prepare).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("answers 422 to a body that is not launch data", async () => {
    await expectProblem(await call("short"), 422, "api.validation_failed");
  });

  it("answers 429 to one address that tries too often, others are not affected", async () => {
    for (let i = 0; i < 20; i++) expect((await call(launch(), "198.51.100.1")).status).toBe(200);
    await expectProblem(await call(launch(), "198.51.100.1"), 429, "api.too_many_requests");
    expect((await call(launch(), "198.51.100.2")).status).toBe(200);
  });

  it("answers 500 when the session cannot be opened", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "token expired" } });
    expect((await call(launch())).status).toBe(500);
  });
});
