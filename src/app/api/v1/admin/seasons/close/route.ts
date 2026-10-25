import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { invalidateRating } from "@/server/cache";
import { closeSeason } from "@/server/services/admin-seasons";

export const POST = withApi(endpoints.adminSeasonClose, async ({ supabase, body }) => {
  const data = await closeSeason(supabase, body.seasonId);
  invalidateRating();
  return { data };
});
