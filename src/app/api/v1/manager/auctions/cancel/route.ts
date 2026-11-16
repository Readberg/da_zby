import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { enforceLimit } from "@/server/services/manager/limits";
import { withApi } from "@/server/api/v1/with-api";
import { cancelLot } from "@/server/services/manager/auction";

export const POST = withApi(endpoints.managerCancelLot, async ({ request, user, body }) => {
  enforceLimit(request, user!.id, "cancelLot");
  return { data: await cancelLot(createAdminClient(), user!.id, body.auctionId) };
});
