import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { WebhookState } from "./webhook-health";

export type Health = {
  status: "ok";
  checks: { database: "ok" | "error"; telegramWebhook: WebhookState };
};

/** True when any check failed (a skipped check is not a failure). */
export function isDegraded(health: Health): boolean {
  return Object.values(health.checks).includes("error");
}

/** Liveness plus a cheap database probe; never throws, so the endpoint itself stays up. */
export async function getHealth(
  supabase: SupabaseClient<Database>,
  timeoutMs = 2000,
  webhook: () => Promise<WebhookState> = async () => "skipped",
): Promise<Health> {
  let database: Health["checks"]["database"] = "error";
  try {
    // A plain GET on purpose: with `{ head: true }` supabase-js reports a missing table as 204.
    const { error } = await supabase
      .from("tournaments")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(timeoutMs));
    database = error ? "error" : "ok";
  } catch {
    database = "error";
  }
  const telegramWebhook = await webhook().catch((): WebhookState => "error");
  return { status: "ok", checks: { database, telegramWebhook } };
}
