import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getSeason } from "@/server/services/admin-seasons";

export const GET = withApi(endpoints.adminSeasonGet, async ({ supabase, query }) => ({
  data: await getSeason(supabase, query.seasonId),
}));
