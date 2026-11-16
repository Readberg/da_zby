import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { enforceLimit } from "@/server/services/manager/limits";
import { withApi } from "@/server/api/v1/with-api";
import { terminateContract } from "@/server/services/manager/contracts";

export const POST = withApi(endpoints.managerTerminateContract, async ({ request, user, body }) => {
  enforceLimit(request, user!.id, "terminateContract");
  return { data: await terminateContract(createAdminClient(), user!.id, body.playerId) };
});
