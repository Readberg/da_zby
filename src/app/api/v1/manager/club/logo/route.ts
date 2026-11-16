import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { setClubLogo } from "@/server/services/manager/club";

export const PUT = withApi(endpoints.managerSetLogo, async ({ user, body }) => ({
  data: await setClubLogo(createAdminClient(), user!.id, body.path),
}));
