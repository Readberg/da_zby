import "server-only";
import { parseEnv } from "./env-schema";
import { serverEnvSchema } from "./env-server-schema";

export const serverEnv = parseEnv(serverEnvSchema, {
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  YOUTUBE_CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID,
});
