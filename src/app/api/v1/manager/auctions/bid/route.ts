import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { enforceLimit } from "@/server/services/manager/limits";
import { withApi } from "@/server/api/v1/with-api";
import { placeBid } from "@/server/services/manager/auction";

export const POST = withApi(endpoints.managerBid, async ({ request, user, body }) => {
  enforceLimit(request, user!.id, "bid");
  return { data: await placeBid(createAdminClient(), user!.id, body) };
});
