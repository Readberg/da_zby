import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { saveTraining } from "@/server/services/manager/league";

export const PUT = withApi(endpoints.managerSaveTraining, async ({ user, body }) => {
  await saveTraining(createAdminClient(), user!.id, body);
  return { data: { saved: true as const } };
});
