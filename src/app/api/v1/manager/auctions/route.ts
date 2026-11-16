import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getAuctions, listPlayer } from "@/server/services/manager/auction";

export const GET = withApi(endpoints.managerAuctions, async ({ user }) => ({
  data: await getAuctions(createAdminClient(), user!.id),
}));

export const POST = withApi(endpoints.managerListLot, async ({ user, body }) => ({
  data: await listPlayer(createAdminClient(), user!.id, body),
}));
