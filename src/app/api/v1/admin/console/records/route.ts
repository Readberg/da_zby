import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { listRecords, loose } from "@/server/services/admin-console";

export const GET = withApi(endpoints.adminConsoleList, async ({ query }) => ({
  data: await listRecords(loose(createAdminClient()), query),
}));
