import { z } from "zod";

/** Rules shared by the admin forms (browser) and the admin API (server). */

export const SLUG_PATTERN = /^[a-z0-9-]{2,50}$/;

export const tournamentFieldsSchema = z.object({
  name: z.string().trim().min(2, "Минимум 2 символа").max(100, "Максимум 100 символов"),
  slug: z
    .string()
    .trim()
    .regex(SLUG_PATTERN, "2–50 символов: латиница в нижнем регистре, цифры и «-»"),
  pointsExact: z.number().int("Целое число").min(0, "От 0").max(100, "До 100"),
  pointsOutcome: z.number().int("Целое число").min(0, "От 0").max(100, "До 100"),
  isActive: z.boolean(),
});
export type TournamentFields = z.infer<typeof tournamentFieldsSchema>;

export const tournamentUpdateSchema = tournamentFieldsSchema
  .partial()
  .extend({ id: z.uuid("Некорректный id") });
export type TournamentUpdate = z.infer<typeof tournamentUpdateSchema>;

// --- Clubs ---------------------------------------------------------------------------------

export const CLUB_LOGO_MAX_BYTES = 1024 * 1024;
export const CLUB_LOGO_PATH_PATTERN = /^[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Максимум ${max} символов`)
    .transform((value) => (value === "" ? null : value));

export const clubFieldsSchema = z.object({
  name: z.string().trim().min(2, "Минимум 2 символа").max(100, "Максимум 100 символов"),
  shortName: optionalText(20).nullable(),
  logoPath: z.string().regex(CLUB_LOGO_PATH_PATTERN, "Некорректный путь к логотипу").nullable(),
});
export type ClubFields = z.infer<typeof clubFieldsSchema>;

export const clubUpdateSchema = clubFieldsSchema
  .partial()
  .extend({ id: z.uuid("Некорректный id") });
export type ClubUpdate = z.infer<typeof clubUpdateSchema>;

export const idBodySchema = z.object({ id: z.uuid("Некорректный id") });
