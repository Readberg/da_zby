import { z } from "zod";
import {
  matchCreateSchema,
  matchUpdateSchema,
  seasonClubsBodySchema,
  seasonCreateSchema,
  seasonIdBodySchema,
  tourCreateSchema,
  tourUpdateSchema,
} from "@/lib/admin-season-schema";
import { idBodySchema } from "@/lib/admin-schema";

export const seasonSummarySchema = z.object({
  id: z.string(),
  tournamentId: z.string(),
  tournamentName: z.string(),
  name: z.string(),
  status: z.enum(["active", "closed"]),
  closedAt: z.string().nullable().describe("ISO 8601, UTC."),
  clubsCount: z.number().int(),
  toursCount: z.number().int(),
});
export type SeasonSummary = z.infer<typeof seasonSummarySchema>;

export const seasonListSchema = z.object({ items: z.array(seasonSummarySchema) });

export const tourSummarySchema = z.object({
  id: z.string(),
  seasonId: z.string(),
  number: z.number().int(),
  title: z.string().nullable(),
  deadlineOverride: z.string().nullable().describe("ISO 8601, UTC; set by an admin."),
  deadlineAt: z
    .string()
    .nullable()
    .describe("Effective prediction deadline: the override or 10 minutes before the first match."),
  matchesCount: z.number().int(),
});
export type TourSummary = z.infer<typeof tourSummarySchema>;

export const seasonDetailSchema = z.object({
  season: seasonSummarySchema,
  clubIds: z.array(z.string()).describe("Clubs that take part in the season."),
  tours: z.array(tourSummarySchema),
});
export type SeasonDetail = z.infer<typeof seasonDetailSchema>;

export const seasonQuerySchema = z.object({ seasonId: z.uuid() });
export const tourQuerySchema = z.object({ tourId: z.uuid() });

export const seasonClubsResultSchema = z.object({ clubIds: z.array(z.string()) });
export const seasonStateSchema = z.object({
  seasonId: z.string(),
  status: z.enum(["active", "closed"]),
});
export const recalculatedSchema = z.object({ seasonId: z.string() });

export const matchSchema = z.object({
  id: z.string(),
  tourId: z.string(),
  homeClubId: z.string(),
  awayClubId: z.string(),
  homeName: z.string(),
  awayName: z.string(),
  kickoffAt: z.string().describe("ISO 8601, UTC."),
  status: z.enum(["scheduled", "finished", "postponed", "cancelled"]),
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
});
export type MatchDto = z.infer<typeof matchSchema>;

export const tourDetailSchema = z.object({
  tour: tourSummarySchema,
  season: z.object({ id: z.string(), name: z.string(), status: z.enum(["active", "closed"]) }),
  clubs: z
    .array(z.object({ id: z.string(), name: z.string() }))
    .describe("Roster of the season: the clubs a match can be created with."),
  matches: z.array(matchSchema),
});
export type TourDetail = z.infer<typeof tourDetailSchema>;

export const deletedSchema = z.object({ id: z.string() });

export {
  idBodySchema as deleteBodySchema,
  matchCreateSchema as matchCreateBodySchema,
  matchUpdateSchema as matchUpdateBodySchema,
  seasonClubsBodySchema,
  seasonCreateSchema as seasonCreateBodySchema,
  seasonIdBodySchema,
  tourCreateSchema as tourCreateBodySchema,
  tourUpdateSchema as tourUpdateBodySchema,
};
