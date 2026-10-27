import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { invalidateRating } from "@/server/cache";
import { updateUserProfile } from "@/server/services/admin-users";

// withApi has already checked that the caller is an admin; the write itself needs the secret key,
// because the database lets a profile be changed by its owner only.
export const PATCH = withApi(endpoints.adminUserProfile, async ({ body, user }) => {
  const data = await updateUserProfile(createAdminClient(), body, user!.id);
  // Nicknames and photos are part of the cached standings and public profiles.
  invalidateRating();
  return { data };
});
