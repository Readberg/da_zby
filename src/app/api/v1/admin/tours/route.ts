import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { createTour, deleteTour, updateTour } from "@/server/services/admin-matches";

export const POST = withApi(endpoints.adminTourCreate, async ({ supabase, body }) => ({
  data: await createTour(supabase, body),
}));

export const PATCH = withApi(endpoints.adminTourUpdate, async ({ supabase, body }) => ({
  data: await updateTour(supabase, body),
}));

export const DELETE = withApi(endpoints.adminTourDelete, async ({ supabase, body }) => ({
  data: await deleteTour(supabase, body.id),
}));
