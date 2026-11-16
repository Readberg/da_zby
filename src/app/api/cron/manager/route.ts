import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { errorFields, log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRoundsLease } from "@/server/services/manager/rounds-lease";
import { runRounds } from "@/server/services/manager/season";

/** The scheduler may work longer than a visit; what is left waits for the next call. */
const CRON_BUDGET_MS = 40_000;

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * The football manager's round timer (D-129). A scheduler (GitHub Actions) calls it with the same
 * secret as the results timer; it plays every match whose kickoff (10:00 Moscow time) has passed.
 * Without the scheduler the first visit to the section does the same (see catch-up), so a round
 * is never lost, only late.
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
    const admin = createAdminClient();
    const done = await withRoundsLease(admin, () => runRounds(admin, new Date(), CRON_BUDGET_MS));
    if (!done) {
      // Another runner is on it: nothing to do, the next call picks up what is left.
      log("info", "manager.rounds_busy", {});
      return NextResponse.json({ ok: true, busy: true, played: 0 });
    }
    log("info", "manager.rounds", done);
    return NextResponse.json({ ok: true, busy: false, ...done });
  } catch (error) {
    log("error", "manager.rounds_failed", errorFields(error));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
