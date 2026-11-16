import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { confirmReturn } from "@/server/services/manager/club";
import { enforceLimit } from "@/server/services/manager/limits";

export const POST = withApi(endpoints.managerConfirmReturn, async ({ request, user }) => {
  enforceLimit(request, user!.id, "confirmReturn");
  return { data: await confirmReturn(createAdminClient(), user!.id) };
});
