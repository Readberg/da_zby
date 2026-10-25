import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { invalidateRating } from "@/server/cache";
import { setSeasonClubs } from "@/server/services/admin-seasons";

export const PUT = withApi(endpoints.adminSeasonClubs, async ({ supabase, body }) => {
  const data = await setSeasonClubs(supabase, body);
  invalidateRating();
  return { data };
});
