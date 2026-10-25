import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { endpoints } from "@/server/api/v1/endpoints";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import { withApi } from "@/server/api/v1/with-api";
import { loginStatus } from "@/server/services/login-tokens";

export const GET = withApi(endpoints.telegramLoginStatus, async ({ query }) => {
  if (!serverEnv.SUPABASE_SECRET_KEY) {
    throw new ApiError(
      503,
      ERROR_CODES.loginUnavailable,
      "Service Unavailable",
      "Telegram sign-in is not configured.",
    );
  }
  return { data: { status: await loginStatus(createAdminClient(), query.token) } };
});
