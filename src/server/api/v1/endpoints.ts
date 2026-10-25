import { defineEndpoint } from "./endpoint";
import { healthSchema, openApiDocumentSchema, versionSchema } from "./schemas/system";
import { profilePatchSchema } from "@/lib/profile-schema";
import {
  nicknameAvailabilityQuerySchema,
  nicknameAvailabilitySchema,
  profileMeSchema,
} from "./schemas/profile";
import {
  telegramLoginStartSchema,
  telegramLoginStatusQuerySchema,
  telegramLoginStatusSchema,
} from "./schemas/auth";
import { listMetaSchema, videoListSchema, videosQuerySchema } from "./schemas/videos";

/** Registry of all API v1 endpoints: route handlers and the OpenAPI document both read it. */
export const endpoints = {
  health: defineEndpoint({
    method: "get",
    path: "/health",
    summary: "Liveness and database check",
    tags: ["system"],
    auth: "public",
    output: healthSchema,
    cacheControl: "no-store",
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
      "Partial update. The nickname can be set once (onboarding) and is locked afterwards; an empty string clears optional text fields. A photo is uploaded straight to storage (own folder, RLS) and then attached with `avatarPath`; `null` removes it. Role and e-mail cannot be changed here.",
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
};
