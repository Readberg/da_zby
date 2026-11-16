import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getContracts } from "@/server/services/manager/contracts";

export const GET = withApi(endpoints.managerContracts, async ({ user }) => ({
  data: await getContracts(createAdminClient(), user!.id),
}));
