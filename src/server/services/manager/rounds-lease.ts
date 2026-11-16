import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

const LEASE_NAME = "rounds";
/** Longer than the run budget with room to spare; a runner that died frees the lease by itself. */
export const LEASE_SECONDS = 90;

/**
 * Runs `work` only when no other runner (another visit, another instance, the scheduler) holds the
 * lease of the rounds; returns null when someone else does. The lease is released afterwards.
 */
export async function withRoundsLease<T>(admin: Db, work: () => Promise<T>): Promise<T | null> {
  const holder = randomUUID();
  const taken = await admin.rpc("mgr_try_lease", {
    p_name: LEASE_NAME,
    p_holder: holder,
    p_seconds: LEASE_SECONDS,
  });
  if (taken.error) throw taken.error;
  if (!taken.data) return null;
  try {
    return await work();
  } finally {
    await admin.rpc("mgr_release_lease", { p_name: LEASE_NAME, p_holder: holder });
  }
}
