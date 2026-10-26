// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ TELEGRAM_BOT_TOKEN: "123:abc" as string | undefined }));
vi.mock("@/lib/env.server", () => ({ serverEnv: env }));

const { checkWebhook, evaluateWebhook, resetWebhookCache } = await import("./webhook-health");

const SITE = "https://dazby.example";
const WEBHOOK = `${SITE}/api/telegram/webhook`;

describe("evaluateWebhook", () => {
  const now = 1_800_000_000;

  it("is healthy when it points at this site and nothing failed lately", () => {
    expect(evaluateWebhook({ url: WEBHOOK }, WEBHOOK, now)).toBe("ok");
    expect(evaluateWebhook({ url: WEBHOOK, last_error_date: now - 3600 }, WEBHOOK, now)).toBe("ok");
  });

  it("is broken when it points elsewhere (the 25 October incident)", () => {
    expect(evaluateWebhook({ url: "https://dazby.com/api/telegram/webhook" }, WEBHOOK, now)).toBe(
      "error",
    );
    expect(evaluateWebhook({ url: "" }, WEBHOOK, now)).toBe("error");
  });

  it("is broken when Telegram failed to deliver within the last quarter of an hour", () => {
    expect(evaluateWebhook({ url: WEBHOOK, last_error_date: now - 60 }, WEBHOOK, now)).toBe(
      "error",
    );
  });
});

describe("checkWebhook", () => {
  beforeEach(() => {
    resetWebhookCache();
    env.TELEGRAM_BOT_TOKEN = "123:abc";
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  });

  it("is skipped without a bot token or on a local site", async () => {
    const read = vi.fn();
    env.TELEGRAM_BOT_TOKEN = undefined;
    expect(await checkWebhook(Date.now, read)).toBe("skipped");

    env.TELEGRAM_BOT_TOKEN = "123:abc";
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect(await checkWebhook(Date.now, read)).toBe("skipped");
    expect(read).not.toHaveBeenCalled();
  });

  it("reads the webhook, reports its state and asks Telegram at most once a minute", async () => {
    const read = vi.fn().mockResolvedValue({ url: WEBHOOK, pending_update_count: 0 });
    let clock = 1_000_000;
    expect(await checkWebhook(() => clock, read)).toBe("ok");
    clock += 30_000;
    expect(await checkWebhook(() => clock, read)).toBe("ok");
    expect(read).toHaveBeenCalledTimes(1);

    clock += 31_000;
    read.mockResolvedValue({ url: "https://elsewhere.example/api/telegram/webhook" });
    expect(await checkWebhook(() => clock, read)).toBe("error");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("reports an error when Telegram cannot be reached", async () => {
    const read = vi.fn().mockRejectedValue(new Error("network"));
    expect(await checkWebhook(Date.now, read)).toBe("error");
  });
});
