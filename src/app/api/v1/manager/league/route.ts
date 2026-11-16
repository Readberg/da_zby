import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getLeagueView } from "@/server/services/manager/league";

export const GET = withApi(endpoints.managerLeague, async ({ supabase, user }) => ({
  data: await getLeagueView(supabase, user!.id),
}));
