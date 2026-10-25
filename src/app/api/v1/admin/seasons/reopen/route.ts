import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { invalidateRating } from "@/server/cache";
import { reopenSeason } from "@/server/services/admin-seasons";

export const POST = withApi(endpoints.adminSeasonReopen, async ({ supabase, body }) => {
  const data = await reopenSeason(supabase, body.seasonId);
  invalidateRating();
  return { data };
});
