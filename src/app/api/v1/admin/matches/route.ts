import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { invalidateRating } from "@/server/cache";
import { createMatch, deleteMatch, updateMatch } from "@/server/services/admin-matches";

export const POST = withApi(endpoints.adminMatchCreate, async ({ supabase, body }) => {
  const data = await createMatch(supabase, body);
  invalidateRating();
  return { data };
});

export const PATCH = withApi(endpoints.adminMatchUpdate, async ({ supabase, body }) => {
  const data = await updateMatch(supabase, body);
  invalidateRating();
  return { data };
});

export const DELETE = withApi(endpoints.adminMatchDelete, async ({ supabase, body }) => {
  const data = await deleteMatch(supabase, body.id);
  invalidateRating();
  return { data };
});
