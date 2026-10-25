// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureWebhook, isValidWebhookSecret, webhookSecret } from "./telegram-bot";

const TOKEN = "123456789:AAH-abcdefghijklmnopqrstuvwxyz0123456";

afterEach(() => vi.unstubAllGlobals());

describe("webhook secret", () => {
  it("is derived from the token and accepted only when it matches exactly", () => {
    const secret = webhookSecret(TOKEN);
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(secret).not.toContain(TOKEN);
    expect(isValidWebhookSecret(TOKEN, secret)).toBe(true);
    expect(isValidWebhookSecret(TOKEN, secret.slice(0, 63))).toBe(false);
    expect(isValidWebhookSecret(TOKEN, "x".repeat(64))).toBe(false);
    expect(isValidWebhookSecret(TOKEN, null)).toBe(false);
    expect(isValidWebhookSecret("999:other", secret)).toBe(false);
  });

  it("is accepted by Telegram's rules for secret_token (A-Z a-z 0-9 _ -, up to 256)", () => {
    expect(webhookSecret(TOKEN)).toMatch(/^[A-Za-z0-9_-]{1,256}$/);
  });
});

describe("ensureWebhook", () => {
  function stubTelegram(currentUrl: string) {
    const calls: { method: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { body: string }) => {
        const method = String(url).split("/").pop()!;
        calls.push({ method, body: JSON.parse(init.body) });
        const result = method === "getWebhookInfo" ? { url: currentUrl } : true;
        return { json: async () => ({ ok: true, result }) };
      }),
    );
    return calls;
  }

  it("registers the site's webhook with the derived secret when it is not set", async () => {
    const calls = stubTelegram("");
    await expect(ensureWebhook(TOKEN, "https://dazby.example/")).resolves.toBe("set");
    const set = calls.find((c) => c.method === "setWebhook")!;
    expect(set.body).toMatchObject({
      url: "https://dazby.example/api/telegram/webhook",
      secret_token: webhookSecret(TOKEN),
      allowed_updates: ["message", "callback_query"],
    });
  });

  it("does nothing when the webhook already points to the site", async () => {
    const calls = stubTelegram("https://dazby.example/api/telegram/webhook");
    await expect(ensureWebhook(TOKEN, "https://dazby.example")).resolves.toBe("ok");
    expect(calls.map((c) => c.method)).toEqual(["getWebhookInfo"]);
  });
});
