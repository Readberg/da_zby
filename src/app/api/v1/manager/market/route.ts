import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getMarket } from "@/server/services/manager/market";

export const GET = withApi(endpoints.managerMarket, async ({ supabase, user }) => ({
  data: await getMarket(supabase, user!.id),
}));
