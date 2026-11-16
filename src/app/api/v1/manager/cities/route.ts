import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { listCities } from "@/server/services/manager/club";

export const GET = withApi(endpoints.managerCities, async ({ supabase }) => ({
  data: await listCities(supabase),
}));
