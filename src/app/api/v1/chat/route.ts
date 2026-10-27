import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { deleteChatMessage, listChat, sendChatMessage } from "@/server/services/chat";

export const GET = withApi(endpoints.chatList, async ({ supabase, user }) => ({
  data: await listChat(supabase, user!.id),
}));

export const POST = withApi(endpoints.chatSend, async ({ supabase, user, body }) => ({
  data: await sendChatMessage(supabase, user!.id, body),
}));

export const DELETE = withApi(endpoints.chatDelete, async ({ supabase, body }) => ({
  data: await deleteChatMessage(supabase, body.id),
}));
