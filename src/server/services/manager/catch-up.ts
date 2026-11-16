import { serverEnv } from "@/lib/env.server";
import { errorFields, log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRoundsLease } from "./rounds-lease";
import { runRounds } from "./season";

/** The shortest pause between two checks of one process while the round is being played. */
export const BUSY_GAP_MS = 30_000;
/** The pause when nothing was due at the last check. */
export const IDLE_GAP_MS = 120_000;
/** The morning window (Moscow time) in which the round is played: checks stay frequent. */
const WINDOW_START_MIN = 9 * 60 + 55;
const WINDOW_END_MIN = 10 * 60 + 40;
/** A full run even when the cheap check says nothing, now and then (contracts, safety net). */
export const FULL_RUN_GAP_MS = 30 * 60_000;

let lastCheckAt = 0;
let lastFullAt = 0;
let lastFoundWork = false;

/** Minutes since midnight in Moscow (UTC+3, no daylight saving). */
function moscowMinutes(now: Date): number {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + 180) % 1440;
}

/** How long this process waits before it looks again. */
export function checkGapMs(now: Date, foundWork: boolean): number {
  const minutes = moscowMinutes(now);
  const inWindow = minutes >= WINDOW_START_MIN && minutes < WINDOW_END_MIN;
  return foundWork || inWindow ? BUSY_GAP_MS : IDLE_GAP_MS;
}

/**
 * Plays the rounds that are due. The scheduler does this every day at 10:00 Moscow time; this is
 * the safety net for the days it does not (a missing secret, a late or skipped run) and the helper
 * of the scheduler in the minutes after 10:00 (the matches of a league wait for its delay).
 * A visit costs nothing in the common case: it is skipped at once while this process has looked
 * recently, and otherwise one cheap query asks whether anything is due. Only one runner works at a
 * time (a lease in the database). It never throws: a visit must not fail because a round could not
 * be played.
 */
export async function catchUpRounds(now: Date = new Date()): Promise<void> {
  if (!serverEnv.SUPABASE_SECRET_KEY) return;
  const t = now.getTime();
  if (t - lastCheckAt < checkGapMs(now, lastFoundWork)) return;
  lastCheckAt = t;
  try {
    const admin = createAdminClient();
    const due = await admin.rpc("mgr_work_due", { p_now: now.toISOString() });
    if (due.error) throw due.error;
    const full = t - lastFullAt >= FULL_RUN_GAP_MS;
    lastFoundWork = Boolean(due.data);
    if (!due.data && !full) return;
    lastFullAt = t;
    const done = await withRoundsLease(admin, () => runRounds(admin, now));
    if (done && Object.values(done).some((n) => typeof n === "number" && n > 0)) {
      log("info", "manager.catch_up", done);
    }
  } catch (error) {
    log("error", "manager.catch_up_failed", errorFields(error));
  }
}

/** For tests. */
export function resetCatchUp() {
  lastCheckAt = 0;
  lastFullAt = 0;
  lastFoundWork = false;
}
