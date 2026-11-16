import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { enforceLimit } from "@/server/services/manager/limits";
import { withApi } from "@/server/api/v1/with-api";
import { getLineup, saveLineup } from "@/server/services/manager/league";

export const GET = withApi(endpoints.managerLineup, async ({ supabase, user }) => ({
  data: await getLineup(supabase, user!.id),
}));

export const PUT = withApi(endpoints.managerSaveLineup, async ({ request, user, body }) => {
  enforceLimit(request, user!.id, "lineup");
  await saveLineup(createAdminClient(), user!.id, body);
  return { data: { saved: true as const } };
});
