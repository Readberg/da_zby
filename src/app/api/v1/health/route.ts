import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getHealth } from "@/server/services/health";
import { checkWebhook } from "@/server/services/webhook-health";

export const GET = withApi(endpoints.health, async ({ supabase }) => ({
  data: await getHealth(supabase, undefined, checkWebhook),
}));
