import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { loose, runAction } from "@/server/services/admin-console";

export const POST = withApi(endpoints.adminConsoleAction, async ({ body, user }) => ({
  data: await runAction(loose(createAdminClient()), user!.id, body),
}));
