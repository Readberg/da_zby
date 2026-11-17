import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { listSuspicious, loose } from "@/server/services/admin-console";

export const GET = withApi(endpoints.adminSuspicious, async () => ({
  data: { items: await listSuspicious(loose(createAdminClient())) },
}));
