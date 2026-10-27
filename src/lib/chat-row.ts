import type { ChatMessage } from "@/server/api/v1/schemas/chat";

/** A `chat_messages` row as Supabase Realtime delivers it. */
export type ChatRow = {
  id: string;
  user_id: string;
  author_nickname: string;
  author_avatar_path: string | null;
  body: string;
  created_at: string;
};

/**
 * Realtime sends timestamps the way Postgres prints them ("2026-10-27 16:27:00.123456+00": a space
 * instead of T and an offset without minutes), which `Date` does not accept. Returns ISO 8601 in
 * UTC, or null when the value is not a time at all.
 */
export function parseRowTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const iso = value
    .trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** The message of a Realtime row, or null if the row cannot be shown (never throws). */
export function messageFromRow(row: Partial<ChatRow> | null | undefined): ChatMessage | null {
  const createdAt = parseRowTime(row?.created_at);
  if (!row || !createdAt || !row.id || !row.user_id || !row.author_nickname || !row.body) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.author_nickname,
    avatarPath: row.author_avatar_path ?? null,
    body: row.body,
    createdAt,
  };
}
