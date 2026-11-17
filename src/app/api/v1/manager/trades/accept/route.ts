import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { enforceLimit } from "@/server/services/manager/limits";
import { withApi } from "@/server/api/v1/with-api";
import { acceptTrade } from "@/server/services/manager/trade";

export const POST = withApi(endpoints.managerAcceptTrade, async ({ request, user, body }) => {
  enforceLimit(request, user!.id, "answerTrade");
  return { data: await acceptTrade(createAdminClient(), user!.id, body.tradeId) };
});
