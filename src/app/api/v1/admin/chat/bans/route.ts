import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { setChatBan } from "@/server/services/chat";

export const PUT = withApi(endpoints.adminChatBan, async ({ supabase, user, body }) => ({
  data: await setChatBan(supabase, user!.id, body),
}));
