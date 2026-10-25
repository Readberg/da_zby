import { z } from "zod";

/** Rules shared by the season / tour / match admin forms (browser) and the admin API (server). */

const id = z.uuid("Некорректный id");
const utcInstant = z.iso.datetime({ offset: true, error: "Некорректная дата и время" });
const optionalTitle = z
  .string()
  .trim()
  .max(100, "Максимум 100 символов")
  .transform((value) => (value === "" ? null : value));

export const seasonCreateSchema = z.object({
  tournamentId: id,
  name: z.string().trim().min(2, "Минимум 2 символа").max(100, "Максимум 100 символов"),
  copyFromSeasonId: id.nullable().optional(),
});
export type SeasonCreate = z.infer<typeof seasonCreateSchema>;

export const seasonIdBodySchema = z.object({ seasonId: id });

export const seasonClubsBodySchema = z.object({
  seasonId: id,
  clubIds: z.array(id).max(200, "Слишком много клубов"),
});
export type SeasonClubsBody = z.infer<typeof seasonClubsBodySchema>;

export const tourCreateSchema = z.object({
  seasonId: id,
  number: z.number().int("Целое число").min(1, "От 1").max(500, "До 500").optional(),
  title: optionalTitle.nullable().optional(),
  deadlineOverride: utcInstant.nullable().optional(),
});
export type TourCreate = z.infer<typeof tourCreateSchema>;

export const tourUpdateSchema = z.object({
  id,
  number: z.number().int("Целое число").min(1, "От 1").max(500, "До 500").optional(),
  title: optionalTitle.nullable().optional(),
  deadlineOverride: utcInstant.nullable().optional(),
});
export type TourUpdate = z.infer<typeof tourUpdateSchema>;

export const MATCH_STATUSES = ["scheduled", "finished", "postponed", "cancelled"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

const score = z.number().int("Целое число").min(0, "От 0").max(99, "До 99");

export const matchCreateSchema = z
  .object({
    tourId: id,
    homeClubId: id,
    awayClubId: id,
    kickoffAt: utcInstant,
  })
  .refine((match) => match.homeClubId !== match.awayClubId, {
    message: "Хозяева и гости должны быть разными клубами",
    path: ["awayClubId"],
  });
export type MatchCreate = z.infer<typeof matchCreateSchema>;

export const matchUpdateSchema = z.object({
  id,
  homeClubId: id.optional(),
  awayClubId: id.optional(),
  kickoffAt: utcInstant.optional(),
  status: z.enum(MATCH_STATUSES).optional(),
  homeScore: score.nullable().optional(),
  awayScore: score.nullable().optional(),
});
export type MatchUpdate = z.infer<typeof matchUpdateSchema>;
