import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { invalidateRating } from "@/server/cache";
import { createTour, deleteTour, updateTour } from "@/server/services/admin-matches";

export const POST = withApi(endpoints.adminTourCreate, async ({ supabase, body }) => {
  const data = await createTour(supabase, body);
  invalidateRating();
  return { data };
});

export const PATCH = withApi(endpoints.adminTourUpdate, async ({ supabase, body }) => {
  const data = await updateTour(supabase, body);
  invalidateRating();
  return { data };
});

export const DELETE = withApi(endpoints.adminTourDelete, async ({ supabase, body }) => {
  const data = await deleteTour(supabase, body.id);
  invalidateRating();
  return { data };
});
