import { z } from "zod";

// Kept apart from env-schema.ts on purpose: that file reaches the browser bundle, and the names
// of server-only variables must not (checked in CI by "No server secrets in the client bundle").
export const serverEnvSchema = z.object({
  // Not used by any feature yet, so it stays optional until the first admin operation needs it.
  SUPABASE_SECRET_KEY: z
    .string()
    .regex(/^(sb_secret_|eyJ)/, "expected an sb_secret_… key (or the legacy service_role JWT)")
    .optional(),
  YOUTUBE_CHANNEL_ID: z.string().regex(/^UC[\w-]{22}$/, "expected a channel id like UC…"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
