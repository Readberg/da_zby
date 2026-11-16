import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getRating } from "@/server/services/manager/rating";

export const GET = withApi(endpoints.managerRating, async ({ user, query }) => ({
  data: await getRating(createAdminClient(), user!.id, query),
}));
