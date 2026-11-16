import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getScorers } from "@/server/services/manager/stats";

export const GET = withApi(endpoints.managerScorers, async ({ user }) => ({
  data: await getScorers(createAdminClient(), user!.id),
}));
