import { z } from "zod";

export const telegramLoginStartSchema = z.object({
  token: z
    .string()
    .describe("Secret of this sign-in attempt; keep it in the browser, never log it."),
  code: z.string().describe("Two-digit number to show; the visitor picks it in the bot."),
  appUrl: z.string().describe("tg:// link that opens the bot in the Telegram app."),
  webUrl: z.string().describe("https://t.me link for devices without the app."),
  expiresInSeconds: z.number().int(),
});

export const telegramLoginStatusQuerySchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/, "Invalid token"),
});

export const telegramLoginStatusSchema = z.object({
  status: z
    .enum(["pending", "confirmed", "expired"])
    .describe("confirmed: continue to /auth/telegram?token=… to open the session."),
});
