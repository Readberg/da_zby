import { createAdminClient } from "@/lib/supabase/admin";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { endpoints } from "@/server/api/v1/endpoints";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import { withApi } from "@/server/api/v1/with-api";
import { createClub, getMyClub } from "@/server/services/manager/club";

export const GET = withApi(endpoints.managerClub, async ({ supabase, user }) => ({
  data: await getMyClub(supabase, user!.id),
}));

export const POST = withApi(
  endpoints.managerCreateClub,
  async ({ request, supabase, user, body }) => {
    // Making a club is rare; this only stops a script from trying names in a loop.
    if (!allowRequest(`manager-club:${user!.id}:${clientIp(request.headers)}`, 10, 10 * 60_000)) {
      throw new ApiError(
        429,
        ERROR_CODES.tooManyRequests,
        "Too Many Requests",
        "Too many attempts. Try again in a few minutes.",
      );
    }
    return { data: await createClub(createAdminClient(), supabase, user!.id, body) };
  },
);
