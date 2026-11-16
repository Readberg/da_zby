import { z } from "zod";

// Rating of the managers by Elo (DAZBY-155).

export const ratingQuerySchema = z.object({
  scope: z
    .enum(["all", "league"])
    .default("all")
    .describe("all = every real club; league = the clubs of my league."),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type RatingQuery = z.infer<typeof ratingQuerySchema>;

export const ratingRowSchema = z.object({
  rank: z.number().int(),
  clubId: z.uuid(),
  name: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  logoUrl: z.string().nullable(),
  leagueNumber: z.number().int().nullable(),
  elo: z.number().int(),
  eloPeak: z.number().int(),
  isMine: z.boolean(),
});

export const ratingSchema = z.object({
  items: z.array(ratingRowSchema),
  total: z
    .number()
    .int()
    .describe("Real clubs in the chosen scope (bots are never in the rating)."),
  page: z.number().int(),
  pageSize: z.number().int(),
  mine: z
    .object({ rank: z.number().int(), elo: z.number().int() })
    .nullable()
    .describe("My club's place in the whole rating (all scope); null without a club."),
});
export type Rating = z.infer<typeof ratingSchema>;
