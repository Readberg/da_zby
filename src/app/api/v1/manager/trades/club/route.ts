import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getClubSquad } from "@/server/services/manager/trade";

export const GET = withApi(endpoints.managerClubSquad, async ({ user, query }) => ({
  data: await getClubSquad(createAdminClient(), user!.id, query.clubId),
}));
