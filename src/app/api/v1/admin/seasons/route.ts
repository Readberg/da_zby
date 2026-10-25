import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { createSeason, listSeasons } from "@/server/services/admin-seasons";

export const GET = withApi(endpoints.adminSeasonsList, async ({ supabase }) => ({
  data: await listSeasons(supabase),
}));

export const POST = withApi(endpoints.adminSeasonCreate, async ({ supabase, body }) => ({
  data: await createSeason(supabase, body),
}));
