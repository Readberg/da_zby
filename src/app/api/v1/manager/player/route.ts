import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getMyPlayer } from "@/server/services/manager/club";

export const GET = withApi(endpoints.managerPlayer, async ({ supabase, query }) => ({
  data: await getMyPlayer(supabase, query.id),
}));
