import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { cancelLot } from "@/server/services/manager/auction";

export const POST = withApi(endpoints.managerCancelLot, async ({ user, body }) => ({
  data: await cancelLot(createAdminClient(), user!.id, body.auctionId),
}));
