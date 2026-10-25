import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { createMatch, deleteMatch, updateMatch } from "@/server/services/admin-matches";

export const POST = withApi(endpoints.adminMatchCreate, async ({ supabase, body }) => ({
  data: await createMatch(supabase, body),
}));

export const PATCH = withApi(endpoints.adminMatchUpdate, async ({ supabase, body }) => ({
  data: await updateMatch(supabase, body),
}));

export const DELETE = withApi(endpoints.adminMatchDelete, async ({ supabase, body }) => ({
  data: await deleteMatch(supabase, body.id),
}));
