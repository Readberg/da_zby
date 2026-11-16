import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { enforceLimit } from "@/server/services/manager/limits";
import { withApi } from "@/server/api/v1/with-api";
import { closeTrade } from "@/server/services/manager/trade";

export const POST = withApi(endpoints.managerCancelTrade, async ({ request, user, body }) => {
  enforceLimit(request, user!.id, "answerTrade");
  return { data: await closeTrade(createAdminClient(), user!.id, body.tradeId, "cancel") };
});
