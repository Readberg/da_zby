import { defineEndpoint } from "./endpoint";
import { marketEndpoints } from "./endpoints-market";
import { healthSchema, openApiDocumentSchema, versionSchema } from "./schemas/system";
import { profilePatchSchema } from "@/lib/profile-schema";
import {
  nicknameAvailabilityQuerySchema,
  nicknameAvailabilitySchema,
  profileMeSchema,
} from "./schemas/profile";
import { predictionsSaveBodySchema, predictionsSavedSchema } from "./schemas/predictions";
import {
  telegramLoginStartSchema,
  telegramMiniAppBodySchema,
  telegramMiniAppSchema,
  telegramLoginStatusQuerySchema,
  telegramLoginStatusSchema,
} from "./schemas/auth";
import {
  chatBanBodySchema,
  chatBanSchema,
  chatDeleteBodySchema,
  chatDeletedSchema,
  chatListSchema,
  chatMessageSchema,
  chatSendBodySchema,
} from "./schemas/chat";
import { listMetaSchema, videoListSchema, videosQuerySchema } from "./schemas/videos";
import { adminEndpoints } from "./endpoints-admin";
import { managerEndpoints } from "./endpoints-manager";

/** Registry of all API v1 endpoints: route handlers and the OpenAPI document both read it. */
export const endpoints = {
  ...marketEndpoints,
  health: defineEndpoint({
    method: "get",
    path: "/health",
    summary: "Liveness and database check",
    tags: ["system"],
    auth: "public",
    output: healthSchema,
    cacheControl: "no-store",
  }),
  healthStrict: defineEndpoint({
    method: "get",
    path: "/health/strict",
    summary: "Health check that fails (503) when any check fails",
    description:
      "Same payload as `/health`, but the status is 503 when the database or the sign-in bot's webhook is broken. For monitors that alert on a non-2xx answer.",
    tags: ["system"],
    auth: "public",
    output: healthSchema,
    cacheControl: "no-store",
    errors: [503],
  }),
  version: defineEndpoint({
    method: "get",
    path: "/version",
    summary: "Application version and supported API versions",
    tags: ["system"],
    auth: "public",
    output: versionSchema,
    cacheControl: "public, max-age=60",
  }),
  openapi: defineEndpoint({
    method: "get",
    path: "/openapi.json",
    summary: "OpenAPI 3.1 document of API v1",
    description: "Returned as is, without the { data, meta } envelope.",
    tags: ["system"],
    auth: "public",
    output: openApiDocumentSchema,
    cacheControl: "public, max-age=300",
  }),
  meGet: defineEndpoint({
    method: "get",
    path: "/me",
    summary: "Own profile",
    tags: ["profile"],
    auth: "user",
    output: profileMeSchema,
    cacheControl: "private, no-store",
    errors: [401, 404],
  }),
  mePatch: defineEndpoint({
    method: "patch",
    path: "/me",
    summary: "Update own profile",
    description:
      "Partial update. The nickname can be changed at any time (it must stay unique); an empty string clears optional text fields. A photo is uploaded straight to storage (own folder, RLS) and then attached with `avatarPath`; `null` removes it. Role and e-mail cannot be changed here.",
    tags: ["profile"],
    auth: "user",
    body: profilePatchSchema,
    output: profileMeSchema,
    cacheControl: "private, no-store",
    errors: [400, 401, 404, 409, 422],
  }),
  nicknameAvailability: defineEndpoint({
    method: "get",
    path: "/nickname-availability",
    summary: "Check whether a nickname is valid and free",
    tags: ["profile"],
    auth: "public",
    query: nicknameAvailabilityQuerySchema,
    output: nicknameAvailabilitySchema,
    cacheControl: "no-store",
    errors: [422],
  }),
  predictionsSave: defineEndpoint({
    method: "put",
    path: "/predictions",
    summary: "Save the caller's predictions for matches of one tour",
    description:
      "New predictions are inserted, existing ones changed. Allowed while the season is active, the match is not played or cancelled and the tour deadline has not passed (the database enforces it): otherwise 409 predictions.closed. A match outside the tour is 422. Scores are whole numbers 0–99.",
    tags: ["predictions"],
    auth: "user",
    body: predictionsSaveBodySchema,
    output: predictionsSavedSchema,
    cacheControl: "private, no-store",
    errors: [400, 401, 409, 422],
  }),
  ...adminEndpoints,
  telegramLoginStart: defineEndpoint({
    method: "post",
    path: "/auth/telegram/start",
    summary: "Start signing in through the Telegram bot",
    description:
      "Creates a one-time attempt (valid 10 minutes). The visitor opens the bot link, presses Start and picks the two-digit `code` in the bot; poll `/auth/telegram/status` until it says `confirmed`, then go to `/auth/telegram?token=…`.",
    tags: ["auth"],
    auth: "public",
    output: telegramLoginStartSchema,
    cacheControl: "no-store",
    errors: [429, 503],
  }),
  telegramMiniAppLogin: defineEndpoint({
    method: "post",
    path: "/auth/telegram/miniapp",
    summary: "Sign in from inside the Telegram Mini App",
    description:
      "The site opened as a Mini App sends the signed launch data it got from Telegram. The signature is checked with the bot token and the launch must be less than an hour old; then the session cookie is set for that Telegram user (an account is created on the first visit). No number to pick: Telegram has already shown who the visitor is.",
    tags: ["auth"],
    auth: "public",
    body: telegramMiniAppBodySchema,
    output: telegramMiniAppSchema,
    cacheControl: "no-store",
    errors: [401, 422, 429, 503],
  }),
  telegramLoginStatus: defineEndpoint({
    method: "get",
    path: "/auth/telegram/status",
    summary: "Progress of a Telegram sign-in attempt",
    tags: ["auth"],
    auth: "public",
    query: telegramLoginStatusQuerySchema,
    output: telegramLoginStatusSchema,
    cacheControl: "no-store",
    errors: [422],
  }),
  videos: defineEndpoint({
    method: "get",
    path: "/videos",
    summary: "Latest regular videos of the YouTube channel (no Shorts), newest first",
    description:
      "Read from the channel's RSS and cached for an hour. If YouTube fails, the last cached list is returned; without one the endpoint answers 503 videos.unavailable.",
    tags: ["videos"],
    auth: "public",
    query: videosQuerySchema,
    output: videoListSchema,
    meta: listMetaSchema,
    cacheControl: "public, max-age=300",
    errors: [422, 503],
  }),
  chatList: defineEndpoint({
    method: "get",
    path: "/chat",
    summary: "The common chat: messages of the last 3 days",
    description:
      "Signed-in users only. Messages older than 3 days are not returned and are deleted for good (D-098). Live updates come through Supabase Realtime; this endpoint is the first load and the fallback.",
    tags: ["chat"],
    auth: "user",
    output: chatListSchema,
    cacheControl: "private, no-store",
    errors: [401],
  }),
  chatSend: defineEndpoint({
    method: "post",
    path: "/chat",
    summary: "Write to the common chat",
    description:
      "1–500 characters. One message per 2 seconds per user (429 api.too_many_requests). A user an admin has shut out gets 403 chat.banned; a user without a nickname gets 409 chat.no_nickname.",
    tags: ["chat"],
    auth: "user",
    body: chatSendBodySchema,
    output: chatMessageSchema,
    cacheControl: "private, no-store",
    errors: [400, 401, 403, 409, 422, 429],
  }),
  chatDelete: defineEndpoint({
    method: "delete",
    path: "/chat",
    summary: "Delete a chat message",
    description:
      "The author deletes their own message; an admin deletes any. A message of someone else is 404.",
    tags: ["chat"],
    auth: "user",
    body: chatDeleteBodySchema,
    output: chatDeletedSchema,
    cacheControl: "private, no-store",
    errors: [400, 401, 404, 422],
  }),
  adminChatBan: defineEndpoint({
    method: "put",
    path: "/admin/chat/bans",
    summary: "Shut a user out of the chat or let them back",
    description:
      "Idempotent. Messages the user already wrote stay until deleted or until 3 days pass.",
    tags: ["admin"],
    auth: "admin",
    body: chatBanBodySchema,
    output: chatBanSchema,
    cacheControl: "private, no-store",
    errors: [400, 401, 403, 404, 422],
  }),
  ...managerEndpoints,
};
