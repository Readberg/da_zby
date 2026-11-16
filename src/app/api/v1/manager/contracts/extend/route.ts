import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { extendContract } from "@/server/services/manager/contracts";

export const POST = withApi(endpoints.managerExtendContract, async ({ user, body }) => ({
  data: await extendContract(createAdminClient(), user!.id, body),
}));
