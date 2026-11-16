import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { listMyMatches } from "@/server/services/manager/league";

export const GET = withApi(endpoints.managerMatches, async ({ supabase, user }) => ({
  data: await listMyMatches(supabase, user!.id),
}));
