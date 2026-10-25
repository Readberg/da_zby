import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { setUserRole } from "@/server/services/admin-users";

export const PATCH = withApi(endpoints.adminUserRole, async ({ supabase, body }) => ({
  data: await setUserRole(supabase, body),
}));
