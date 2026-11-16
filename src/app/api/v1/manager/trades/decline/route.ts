import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { closeTrade } from "@/server/services/manager/trade";

export const POST = withApi(endpoints.managerDeclineTrade, async ({ user, body }) => ({
  data: await closeTrade(createAdminClient(), user!.id, body.tradeId, "decline"),
}));
