import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getPlayerStats } from "@/server/services/manager/stats";

export const GET = withApi(endpoints.managerPlayerStats, async ({ user, query }) => ({
  data: await getPlayerStats(createAdminClient(), user!.id, query.id),
}));
