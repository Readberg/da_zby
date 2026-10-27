import { z } from "zod";

const matchState = z.object({
  kickoffAt: z.string().describe("ISO 8601, UTC."),
  status: z.enum(["scheduled", "finished", "postponed", "cancelled"]),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
});

export const fixturesQuerySchema = z.object({
  tourId: z.uuid(),
  round: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .optional()
    .describe("Round of the league; the number of the tour by default."),
});

export const fixturesApplyBodySchema = z.object({
  tourId: z.uuid(),
  round: z.number().int().min(1).max(60).optional(),
  keys: z
    .array(z.string().min(1).max(200))
    .min(1, "Нечего применять")
    .max(40, "Слишком много матчей")
    .describe("Keys of the preview rows the admin confirmed."),
});

export const fixturePlanRowSchema = z.object({
  key: z.string(),
  fixture: z.object({
    home: z.string(),
    away: z.string(),
    kickoffAt: z.string(),
    status: z.enum(["scheduled", "finished", "postponed", "cancelled", "live"]),
    homeScore: z.number().int().nullable(),
    awayScore: z.number().int().nullable(),
  }),
  homeName: z.string().nullable().describe("Name in our catalogue; null when not found."),
  awayName: z.string().nullable(),
  action: z.enum(["create", "update", "same", "blocked"]),
  current: matchState.nullable(),
  next: matchState.nullable(),
  matchId: z.string().nullable(),
  notes: z.array(z.string()),
});

export const fixturesPreviewSchema = z.object({
  source: z.string(),
  season: z.string(),
  round: z.number().int(),
  rows: z.array(fixturePlanRowSchema),
  extra: z.array(z.object({ matchId: z.string(), homeName: z.string(), awayName: z.string() })),
});
export type FixturesPreview = z.infer<typeof fixturesPreviewSchema>;

export const fixturesAppliedSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  skipped: z.array(z.object({ key: z.string(), reason: z.string() })),
});
export type FixturesApplied = z.infer<typeof fixturesAppliedSchema>;
