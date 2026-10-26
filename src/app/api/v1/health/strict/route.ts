import { endpoints } from "@/server/api/v1/endpoints";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import { withApi } from "@/server/api/v1/with-api";
import { getHealth, isDegraded } from "@/server/services/health";
import { checkWebhook } from "@/server/services/webhook-health";

export const GET = withApi(endpoints.healthStrict, async ({ supabase }) => {
  const health = await getHealth(supabase, undefined, checkWebhook);
  if (isDegraded(health)) {
    const failed = Object.entries(health.checks)
      .filter(([, state]) => state === "error")
      .map(([name]) => name)
      .join(", ");
    throw new ApiError(
      503,
      ERROR_CODES.degraded,
      "Service Unavailable",
      `Failed checks: ${failed}.`,
    );
  }
  return { data: health };
});
