import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { enforceLimit } from "@/server/services/manager/limits";
import { withApi } from "@/server/api/v1/with-api";
import { setClubLogo } from "@/server/services/manager/club";

export const PUT = withApi(endpoints.managerSetLogo, async ({ request, user, body }) => {
  enforceLimit(request, user!.id, "logo");
  return { data: await setClubLogo(createAdminClient(), user!.id, body.path) };
});
