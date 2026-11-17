import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { enforceLimit } from "@/server/services/manager/limits";
import { withApi } from "@/server/api/v1/with-api";
import { saveTraining } from "@/server/services/manager/league";

export const PUT = withApi(endpoints.managerSaveTraining, async ({ request, user, body }) => {
  enforceLimit(request, user!.id, "training");
  await saveTraining(createAdminClient(), user!.id, body);
  return { data: { saved: true as const } };
});
