import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { editRecord, getRecord, loose } from "@/server/services/admin-console";

export const GET = withApi(endpoints.adminConsoleRecord, async ({ query }) => {
  const record = await getRecord(loose(createAdminClient()), query.entity, query.id);
  if (!record) throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "No such record.");
  return { data: { record } };
});

export const PATCH = withApi(endpoints.adminConsoleEdit, async ({ body, user }) => ({
  data: await editRecord(loose(createAdminClient()), user!.id, body),
}));
