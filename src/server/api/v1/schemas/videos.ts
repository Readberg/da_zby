import { z } from "zod";

export const videosQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("How many videos to return, 1–100 (default 20)."),
});

export const videoSchema = z.object({
  id: z.string().describe("YouTube video id."),
  title: z.string(),
  publishedAt: z.string().describe("ISO 8601 publication time in UTC."),
  thumbnailUrl: z.url().describe("480×360 preview image."),
  url: z.url().describe("Watch page on YouTube."),
});

export const videoListSchema = z.array(videoSchema);

export const listMetaSchema = z.object({
  limit: z.number().int(),
  nextCursor: z.string().nullable(),
});
