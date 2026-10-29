// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./helpers";

const SECRET = "s".repeat(32);

const env = vi.hoisted(() => ({
  CRON_SECRET: undefined as string | undefined,
  SUPABASE_SECRET_KEY: undefined as string | undefined,
  TELEGRAM_BOT_TOKEN: undefined as string | undefined,
  TELEGRAM_ADMIN_IDS: undefined as string | undefined,
  THESPORTSDB_API_KEY: undefined as string | undefined,
}));
const sync = vi.fn();
const invalidate = vi.fn();
const sendMessage = vi.fn(async () => {});

vi.mock("@/lib/env.server", () => ({ serverEnv: env }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/server/cache", () => ({ invalidateRating: () => invalidate() }));
vi.mock("@/server/services/results-sync", async (original) => ({
  ...(await original<typeof import("@/server/services/results-sync")>()),
  syncResults: (...args: unknown[]) => sync(...args),
}));
vi.mock("@/server/services/telegram-bot", async (original) => ({
  ...(await original<typeof import("@/server/services/telegram-bot")>()),
  createTelegramBot: () => ({ sendMessage }),
}));

const route = await import("@/app/api/cron/results/route");

const call = (token?: string) =>
  route.POST(
    apiRequest("/api/cron/results", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  );

const idle = { due: 0, toursAsked: 0, updated: [], waiting: 0, attention: [] };
const entered = {
  due: 1,
  toursAsked: 1,
  updated: [{ matchId: "m1", home: "Арсенал", away: "БАТЭ", homeScore: 1, awayScore: 0 }],
  waiting: 0,
  attention: [],
};

beforeEach(() => {
  env.CRON_SECRET = SECRET;
  env.SUPABASE_SECRET_KEY = "sb_secret_x";
  env.TELEGRAM_BOT_TOKEN = "123456:TEST-token-0123456789abcdef";
  env.TELEGRAM_ADMIN_IDS = "111,222";
  sync.mockReset().mockResolvedValue(idle);
  invalidate.mockClear();
  sendMessage.mockClear();
});

describe("POST /api/cron/results", () => {
  it("answers 503 when the timer has no secret, and asks nothing", async () => {
    env.CRON_SECRET = undefined;
    expect((await call(SECRET)).status).toBe(503);
    expect(sync).not.toHaveBeenCalled();
  });

  it("answers 401 without the secret or with a wrong one", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("w".repeat(32))).status).toBe(401);
    expect(sync).not.toHaveBeenCalled();
  });

  it("reports an idle run without clearing the cache or writing to anybody", async () => {
    const response = await call(SECRET);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, due: 0, updated: [] });
    expect(invalidate).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("after entering results clears the cached table and tells every admin", async () => {
    sync.mockResolvedValue(entered);
    const response = await call(SECRET);
    expect(response.status).toBe(200);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenCalledWith(111, expect.stringContaining("Арсенал 1:0 БАТЭ"));
  });

  it("keeps the entered results when a Telegram message fails", async () => {
    sync.mockResolvedValue(entered);
    sendMessage.mockRejectedValueOnce(new Error("blocked by the user"));
    const response = await call(SECRET);
    expect(response.status).toBe(200);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("answers 500 when the run itself fails", async () => {
    sync.mockRejectedValue(new Error("database is down"));
    expect((await call(SECRET)).status).toBe(500);
  });
});
