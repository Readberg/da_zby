import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { loose, markReviewed } from "@/server/services/admin-console";

export const POST = withApi(endpoints.adminSuspiciousReview, async ({ body, user }) => {
  await markReviewed(loose(createAdminClient()), user!.id, body);
  return { data: { ok: true as const } };
});
