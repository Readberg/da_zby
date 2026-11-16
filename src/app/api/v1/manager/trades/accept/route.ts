import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { acceptTrade } from "@/server/services/manager/trade";

export const POST = withApi(endpoints.managerAcceptTrade, async ({ user, body }) => ({
  data: await acceptTrade(createAdminClient(), user!.id, body.tradeId),
}));
