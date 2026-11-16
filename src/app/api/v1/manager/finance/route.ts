import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getFinance } from "@/server/services/manager/market";

export const GET = withApi(endpoints.managerFinance, async ({ supabase, user }) => ({
  data: await getFinance(supabase, user!.id),
}));
