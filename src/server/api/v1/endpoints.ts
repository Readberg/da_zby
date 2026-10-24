import { defineEndpoint } from "./endpoint";
import { healthSchema, openApiDocumentSchema, versionSchema } from "./schemas/system";
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
