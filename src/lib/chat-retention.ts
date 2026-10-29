/**
 * How long a chat message lives: 3 days (D-126, before that 24 hours, D-098). The database enforces
 * it (row policy and cleanup, 72 hours in the migration `20261029000000_chat_retention_3_days`); this
 * number is for the API text, the service query and the window that drops old messages on screen.
 */
export const CHAT_TTL_HOURS = 72;
export const CHAT_TTL_MS = CHAT_TTL_HOURS * 3_600_000;
