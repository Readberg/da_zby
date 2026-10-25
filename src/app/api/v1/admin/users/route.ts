import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { listUsers } from "@/server/services/admin-users";

export const GET = withApi(endpoints.adminUsersList, async ({ supabase, query }) => ({
  data: await listUsers(supabase, query),
}));
