import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { enforceLimit } from "@/server/services/manager/limits";
import { withApi } from "@/server/api/v1/with-api";
import { buyFreeAgent } from "@/server/services/manager/market";

export const POST = withApi(endpoints.managerBuy, async ({ request, user, body }) => {
  enforceLimit(request, user!.id, "buy");
  return { data: await buyFreeAgent(createAdminClient(), user!.id, body.playerId) };
});
