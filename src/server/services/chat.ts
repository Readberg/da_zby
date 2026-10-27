import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import {
  CHAT_TTL_HOURS,
  type ChatBanBody,
  type ChatList,
  type ChatMessage,
  type ChatSendBody,
} from "@/server/api/v1/schemas/chat";
import type { Database, Tables } from "@/types/database";

type Db = SupabaseClient<Database>;

/** How many messages one load returns (the newest ones; a day of a small chat fits easily). */
const LOAD_LIMIT = 200;

export function toChatMessage(row: Tables<"chat_messages">): ChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.author_nickname,
    avatarPath: row.author_avatar_path,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Messages of the last 24 hours, oldest first, and whether the caller is shut out of the chat. */
export async function listChat(supabase: Db, userId: string): Promise<ChatList> {
  const since = new Date(Date.now() - CHAT_TTL_HOURS * 3_600_000).toISOString();
  const [messages, banned] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("*")
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(LOAD_LIMIT),
    supabase.rpc("chat_is_banned", { p_user: userId }),
  ]);
  if (messages.error) throw messages.error;
  if (banned.error) throw banned.error;
  return {
    messages: (messages.data ?? []).map(toChatMessage).reverse(),
    banned: banned.data === true,
  };
}

export async function sendChatMessage(
  supabase: Db,
  userId: string,
  { body }: ChatSendBody,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ user_id: userId, body })
    .select("*")
    .single();
  if (error) {
    if (error.message.includes("chat.banned")) {
      throw new ApiError(403, ERROR_CODES.chatBanned, "Forbidden", "You are shut out of the chat.");
    }
    if (error.message.includes("chat.no_nickname")) {
      throw new ApiError(
        409,
        ERROR_CODES.chatNoNickname,
        "Conflict",
        "Choose a nickname before you write in the chat.",
      );
    }
    if (error.message.includes("chat.rate_limited")) {
      throw new ApiError(
        429,
        ERROR_CODES.tooManyRequests,
        "Too Many Requests",
        "One message per 2 seconds.",
      );
    }
    throw error;
  }
  return toChatMessage(data);
}

/** Deletes a message: the author's own, or any for an admin (RLS decides; no row means 404). */
export async function deleteChatMessage(supabase: Db, id: string): Promise<{ id: string }> {
  const { data, error } = await supabase.from("chat_messages").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "Message not found.");
  }
  return { id };
}

/** Shuts a user out of the chat or lets them back. Idempotent. */
export async function setChatBan(
  supabase: Db,
  adminId: string,
  { userId, banned }: ChatBanBody,
): Promise<{ userId: string; banned: boolean }> {
  const { data: target, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!target) {
    throw new ApiError(404, ERROR_CODES.profileNotFound, "Not Found", "User does not exist.");
  }

  const { error } = banned
    ? await supabase
        .from("chat_bans")
        .upsert({ user_id: userId, banned_by: adminId }, { onConflict: "user_id" })
    : await supabase.from("chat_bans").delete().eq("user_id", userId);
  if (error) throw error;
  return { userId, banned };
}
