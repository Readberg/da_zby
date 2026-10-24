import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getOwnProfile, updateOwnProfile } from "@/server/services/profiles";

export const GET = withApi(endpoints.meGet, async ({ supabase, user }) => ({
  data: await getOwnProfile(supabase, user!),
}));

export const PATCH = withApi(endpoints.mePatch, async ({ supabase, user, body }) => ({
  data: await updateOwnProfile(supabase, user!, body),
}));
