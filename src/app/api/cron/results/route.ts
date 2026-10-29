import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { errorFields, log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateRating } from "@/server/cache";
import { fetchRound } from "@/server/services/fixtures-source";
import { reportMessage, syncResults } from "@/server/services/results-sync";
import { createTelegramBot } from "@/server/services/telegram-bot";
import { parseAdminIds } from "@/server/services/telegram-login";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * The results timer (D-127). A scheduler (GitHub Actions, every 10 minutes) calls it with the
 * secret; it enters the results of matches that ended 20 minutes ago or earlier, then clears the
 * cached table and rating and tells the admins in Telegram. With no match to look at it answers
 * at once, without asking the source.
 */
export async function POST(request: NextRequest) {
  const secret = serverEnv.CRON_SECRET;
  if (!secret || !serverEnv.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  const given = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  if (!timingSafeEqual(digest(given), digest(secret))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const report = await syncResults(createAdminClient(), {
      fetchRound,
      apiKey: serverEnv.THESPORTSDB_API_KEY,
    });
    log(report.attention.length > 0 ? "warn" : "info", "results.sync", {
      due: report.due,
      toursAsked: report.toursAsked,
      updated: report.updated.length,
      waiting: report.waiting,
      attention: report.attention,
    });

    if (report.updated.length > 0) {
      invalidateRating();
      const botToken = serverEnv.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const bot = createTelegramBot(botToken);
        for (const id of parseAdminIds(serverEnv.TELEGRAM_ADMIN_IDS)) {
          // A failed message must not undo the entered results.
          await bot.sendMessage(Number(id), reportMessage(report)).catch((error) => {
            log("warn", "results.notify_failed", errorFields(error));
          });
        }
      }
    }
    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    log("error", "results.sync_failed", errorFields(error));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
