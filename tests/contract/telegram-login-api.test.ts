// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/rate-limit";
import { telegramLoginStartSchema, telegramLoginStatusSchema } from "@/server/api/v1/schemas/auth";
import { TooManyLoginAttemptsError } from "@/server/services/login-tokens";
import { apiRequest, expectApiHeaders, expectProblem, fakeSupabase } from "./helpers";

const start = vi.fn();
const status = vi.fn();
const env = vi.hoisted(() => ({
  TELEGRAM_BOT_TOKEN: undefined as string | undefined,
  SUPABASE_SECRET_KEY: undefined as string | undefined,
}));

vi.mock("@/lib/env.server", () => ({ serverEnv: env }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeSupabase() }));
vi.mock("@/server/services/login-tokens", async (original) => ({
  ...(await original<typeof import("@/server/services/login-tokens")>()),
  startLogin: (...args: unknown[]) => start(...args),
  loginStatus: (...args: unknown[]) => status(...args),
}));
vi.mock("@/server/services/telegram-bot", async (original) => ({
  ...(await original<typeof import("@/server/services/telegram-bot")>()),
  getBotUsername: async () => "dazby_bot",
}));

const startRoute = await import("@/app/api/v1/auth/telegram/start/route");
const statusRoute = await import("@/app/api/v1/auth/telegram/status/route");

const TOKEN = "t".repeat(43);

beforeEach(() => {
  resetRateLimits();
  env.TELEGRAM_BOT_TOKEN = "123456:TEST-token-0123456789abcdef";
  env.SUPABASE_SECRET_KEY = "sb_secret_x";
  start.mockReset().mockResolvedValue({ token: TOKEN, code: "47", expiresInSeconds: 600 });
  status.mockReset().mockResolvedValue("pending");
});

describe("POST /api/v1/auth/telegram/start", () => {
  const call = () => startRoute.POST(apiRequest("/api/v1/auth/telegram/start", { method: "POST" }));

  it("returns the token, the number to show and links that open the bot", async () => {
    const response = await call();
    expectApiHeaders(response);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const { data } = await response.json();
    expect(telegramLoginStartSchema.parse(data)).toEqual({
      token: TOKEN,
      code: "47",
      appUrl: `tg://resolve?domain=dazby_bot&start=${TOKEN}`,
      webUrl: `https://t.me/dazby_bot?start=${TOKEN}`,
      expiresInSeconds: 600,
    });
  });

  it("answers 503 when Telegram sign-in is not configured", async () => {
    env.TELEGRAM_BOT_TOKEN = undefined;
    await expectProblem(await call(), 503, "auth.telegram_unavailable");
    expect(start).not.toHaveBeenCalled();
  });

  it("answers 429 when too many attempts are in progress", async () => {
    start.mockRejectedValue(new TooManyLoginAttemptsError());
    await expectProblem(await call(), 429, "api.too_many_requests");
  });

  it("answers 429 to one address that starts too many attempts, others are not affected", async () => {
    const from = (ip: string) =>
      startRoute.POST(
        apiRequest("/api/v1/auth/telegram/start", {
          method: "POST",
          headers: { "x-forwarded-for": ip },
        }),
      );
    for (let i = 0; i < 10; i++) expect((await from("203.0.113.7")).status).toBe(200);
    await expectProblem(await from("203.0.113.7"), 429, "api.too_many_requests");
    expect((await from("203.0.113.8")).status).toBe(200);
  });
});

describe("GET /api/v1/auth/telegram/status", () => {
  const call = (token: string) =>
    statusRoute.GET(apiRequest(`/api/v1/auth/telegram/status?token=${token}`));

  it("reports the progress of the attempt", async () => {
    status.mockResolvedValue("confirmed");
    const response = await call(TOKEN);
    expectApiHeaders(response);
    const { data } = await response.json();
    expect(telegramLoginStatusSchema.parse(data)).toEqual({ status: "confirmed" });
    expect(status).toHaveBeenCalledWith({}, TOKEN);
  });

  it("rejects a malformed token with 422 without asking the database", async () => {
    await expectProblem(await call("short"), 422, "api.validation_failed");
    expect(status).not.toHaveBeenCalled();
  });

  it("answers 503 when the server key is missing", async () => {
    env.SUPABASE_SECRET_KEY = undefined;
    await expectProblem(await call(TOKEN), 503, "auth.telegram_unavailable");
  });
});
