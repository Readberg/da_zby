import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { recalculateSeason } from "@/server/services/admin-seasons";

export const POST = withApi(endpoints.adminSeasonRecalculate, async ({ supabase, body }) => ({
  data: await recalculateSeason(supabase, body.seasonId),
}));
