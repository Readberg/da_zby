import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { enforceLimit } from "@/server/services/manager/limits";
import { withApi } from "@/server/api/v1/with-api";
import { requestFriendly } from "@/server/services/manager/season";

export const POST = withApi(endpoints.managerRequestFriendly, async ({ request, user }) => {
  enforceLimit(request, user!.id, "friendly");
  return { data: await requestFriendly(createAdminClient(), user!.id) };
});
