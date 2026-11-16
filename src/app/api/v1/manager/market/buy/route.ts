import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { buyFreeAgent } from "@/server/services/manager/market";

export const POST = withApi(endpoints.managerBuy, async ({ user, body }) => ({
  data: await buyFreeAgent(createAdminClient(), user!.id, body.playerId),
}));
