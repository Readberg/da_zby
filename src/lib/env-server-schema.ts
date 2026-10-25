import { z } from "zod";

// Kept apart from env-schema.ts on purpose: that file reaches the browser bundle, and the names
// of server-only variables must not (checked in CI by "No server secrets in the client bundle").
export const serverEnvSchema = z.object({
  // Needed for Telegram sign-in (creates users and opens sessions); optional so the site runs without it.
  SUPABASE_SECRET_KEY: z
    .string()
    .regex(/^(sb_secret_|eyJ)/, "expected an sb_secret_… key (or the legacy service_role JWT)")
    .optional(),
  // Telegram sign-in (D-054): token of the login bot and the Telegram ids that become admins.
  TELEGRAM_BOT_TOKEN: z
    .string()
    .regex(/^d+:[w-]{20,}$/, "expected a token like 123456:ABC…")
    .optional(),
  TELEGRAM_ADMIN_IDS: z
    .string()
    .regex(/^d+(,d+)*$/, "expected comma-separated Telegram ids")
    .optional(),
  YOUTUBE_CHANNEL_ID: z.string().regex(/^UC[\w-]{22}$/, "expected a channel id like UC…"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
