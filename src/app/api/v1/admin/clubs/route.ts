import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { invalidateRating } from "@/server/cache";
import { createClub, deleteClub, listClubs, updateClub } from "@/server/services/admin-clubs";

export const GET = withApi(endpoints.adminClubsList, async ({ supabase }) => ({
  data: await listClubs(supabase),
}));

export const POST = withApi(endpoints.adminClubCreate, async ({ supabase, body }) => {
  const data = await createClub(supabase, body);
  invalidateRating();
  return { data };
});

export const PATCH = withApi(endpoints.adminClubUpdate, async ({ supabase, body }) => {
  const data = await updateClub(supabase, body);
  invalidateRating();
  return { data };
});

export const DELETE = withApi(endpoints.adminClubDelete, async ({ supabase, body }) => {
  const data = await deleteClub(supabase, body.id);
  invalidateRating();
  return { data };
});
