import "server-only";
import { parseEnv } from "./env-schema";
import { serverEnvSchema } from "./env-server-schema";

export const serverEnv = parseEnv(serverEnvSchema, {
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_ADMIN_IDS: process.env.TELEGRAM_ADMIN_IDS,
  THESPORTSDB_API_KEY: process.env.THESPORTSDB_API_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  YOUTUBE_CHANNEL_ID: process.env.YOUTUBE_CHANNEL_ID,
});
