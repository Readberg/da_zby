import { z } from "zod";
import {
  clubFieldsSchema,
  clubUpdateSchema,
  idBodySchema,
  tournamentFieldsSchema,
  tournamentUpdateSchema,
} from "@/lib/admin-schema";

export const tournamentSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  kind: z.string().describe("Tournament mechanics; today only score_prediction."),
  pointsExact: z.number().int().describe("Points for an exact score."),
  pointsOutcome: z.number().int().describe("Points for the right outcome only."),
  isActive: z.boolean(),
});
export type Tournament = z.infer<typeof tournamentSchema>;

export const tournamentListSchema = z.object({ items: z.array(tournamentSchema) });

export const tournamentCreateBodySchema = tournamentFieldsSchema;
export const tournamentUpdateBodySchema = tournamentUpdateSchema;

export const recalculateBodySchema = z.object({ tournamentId: z.uuid() });
export const recalculateResultSchema = z.object({
  seasons: z.number().int().describe("How many seasons were re-graded."),
});

export const clubSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().nullable(),
  logoPath: z.string().nullable(),
  logoUrl: z.url().nullable(),
});
export type Club = z.infer<typeof clubSchema>;

export const clubListSchema = z.object({ items: z.array(clubSchema) });

export const clubCreateBodySchema = clubFieldsSchema;
export const clubUpdateBodySchema = clubUpdateSchema;
export const clubDeleteBodySchema = idBodySchema;
export const clubDeletedSchema = z.object({ id: z.string() });
