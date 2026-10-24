import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { checkNickname } from "@/server/services/profiles";

export const GET = withApi(endpoints.nicknameAvailability, async ({ supabase, query }) => ({
  data: await checkNickname(supabase, query.nickname),
}));
