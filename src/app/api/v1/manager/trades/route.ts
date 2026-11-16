import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { enforceLimit } from "@/server/services/manager/limits";
import { withApi } from "@/server/api/v1/with-api";
import { getTrades, proposeTrade } from "@/server/services/manager/trade";

export const GET = withApi(endpoints.managerTrades, async ({ user }) => ({
  data: await getTrades(createAdminClient(), user!.id),
}));

export const POST = withApi(endpoints.managerProposeTrade, async ({ request, user, body }) => {
  enforceLimit(request, user!.id, "proposeTrade");
  return { data: await proposeTrade(createAdminClient(), user!.id, body) };
});
