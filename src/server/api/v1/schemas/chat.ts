import { z } from "zod";

export const CHAT_MAX_LENGTH = 500;
/** How long a message lives (D-098). The database enforces it; the number is for the contract text. */
export const CHAT_TTL_HOURS = 24;

export const chatMessageSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  nickname: z.string(),
  avatarPath: z.string().nullable().describe("Storage path of the author's photo, if any."),
  body: z.string(),
  createdAt: z.string().describe("ISO 8601, UTC."),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatListSchema = z.object({
  messages: z.array(chatMessageSchema).describe("The last 24 hours, oldest first."),
  banned: z.boolean().describe("True if an admin has shut the caller out of the chat."),
});
export type ChatList = z.infer<typeof chatListSchema>;

export const chatSendBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Message is empty.")
    .max(CHAT_MAX_LENGTH, `At most ${CHAT_MAX_LENGTH} characters.`),
});
export type ChatSendBody = z.infer<typeof chatSendBodySchema>;

export const chatDeleteBodySchema = z.object({ id: z.uuid() });
export const chatDeletedSchema = z.object({ id: z.string() });

export const chatBanBodySchema = z.object({
  userId: z.uuid(),
  banned: z.boolean(),
});
export type ChatBanBody = z.infer<typeof chatBanBodySchema>;
export const chatBanSchema = z.object({ userId: z.string(), banned: z.boolean() });
