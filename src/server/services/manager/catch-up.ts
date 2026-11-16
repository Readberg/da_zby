import { serverEnv } from "@/lib/env.server";
import { errorFields, log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRounds } from "./season";

/**
 * Plays the rounds that are due. The scheduler does this every day at 10:00 Moscow time; this is
 * the safety net for the days it does not (a missing secret, a late or skipped run): the first
 * visit to the section after kickoff plays the round. It never throws: a visit must not fail
 * because a round could not be played.
 */
export async function catchUpRounds(): Promise<void> {
  if (!serverEnv.SUPABASE_SECRET_KEY) return;
  try {
    const done = await runRounds(createAdminClient());
    if (done.played + done.closed + done.days + done.opened + done.pools > 0) {
      log("info", "manager.catch_up", done);
    }
  } catch (error) {
    log("error", "manager.catch_up_failed", errorFields(error));
  }
}
