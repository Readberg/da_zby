import { describe, expect, it } from "vitest";
import { serverEnvSchema } from "./env-server-schema";

const base = { YOUTUBE_CHANNEL_ID: "UCsfcA6cY0bSL781TE3XMEPA" };

describe("serverEnvSchema — Telegram sign-in", () => {
  it("accepts a real-looking bot token and admin ids", () => {
    const parsed = serverEnvSchema.safeParse({
      ...base,
      TELEGRAM_BOT_TOKEN: "123456789:AAH-abcdefghijklmnopqrstuvwxyz0123456",
      TELEGRAM_ADMIN_IDS: "123456789,42",
    });
    expect(parsed.success).toBe(true);
  });

  it("keeps both variables optional", () => {
    expect(serverEnvSchema.safeParse(base).success).toBe(true);
  });

  it.each(["abc", "123456789", "123456789:short", "x123:AAH-abcdefghijklmnopqrstuvwxyz"])(
    "rejects the bot token %j",
    (token) => {
      expect(serverEnvSchema.safeParse({ ...base, TELEGRAM_BOT_TOKEN: token }).success).toBe(false);
    },
  );

  it.each(["abc", "42,", "42 7", "42;7"])("rejects the admin ids %j", (ids) => {
    expect(serverEnvSchema.safeParse({ ...base, TELEGRAM_ADMIN_IDS: ids }).success).toBe(false);
  });
});
