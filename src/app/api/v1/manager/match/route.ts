import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getMatch } from "@/server/services/manager/league";

export const GET = withApi(endpoints.managerMatch, async ({ supabase, query }) => ({
  data: await getMatch(supabase, query.id),
}));
