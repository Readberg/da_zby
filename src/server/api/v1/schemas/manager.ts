import { z } from "zod";
import { CLUB_COLORS } from "@/lib/manager/palette";

/** Letters (Latin, Cyrillic) and digits; single spaces between words; at most 30 characters. */
export const CLUB_NAME_PATTERN = /^[A-Za-zА-Яа-яЁёІіЎў0-9]+( [A-Za-zА-Яа-яЁёІіЎў0-9]+)*$/;
export const CLUB_NAME_MAX = 30;

export const managerCitySchema = z.object({
  id: z.number().int(),
  name: z.string(),
});
export const managerCitiesSchema = z.object({
  cities: z.array(managerCitySchema).describe("Cities of the country of the club, by name."),
  colors: z.array(z.string()).describe("The palette a club picks its two colours from."),
});
export type ManagerCities = z.infer<typeof managerCitiesSchema>;

export const managerClubSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  country: z.string().describe("ISO 3166-1 alpha-2 code."),
  city: managerCitySchema,
  primaryColor: z.string(),
  secondaryColor: z.string(),
  createdAt: z.string().describe("ISO 8601, UTC."),
});
export type Club = z.infer<typeof managerClubSchema>;

export const playerSummarySchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.enum(["GK", "DEF", "MID", "FWD"]),
  age: z.number().int(),
  citizenship: z.string(),
  overall: z.number().int().describe("Overall rating, 1–99."),
  real: z
    .number()
    .describe("Rating that counts in a match: overall scaled by form, fitness, morale."),
  form: z.number().int(),
  fitness: z.number().int(),
  morale: z.number().int(),
});
export type PlayerSummary = z.infer<typeof playerSummarySchema>;

export const playerSchema = playerSummarySchema.extend({
  academyClubName: z.string().nullable().describe("The club that made the player."),
  attributes: z.array(z.object({ key: z.string(), value: z.number().int() })),
});
export type Player = z.infer<typeof playerSchema>;

export const managerClubViewSchema = z.object({
  club: managerClubSchema.nullable().describe("Null until the caller has made a club."),
  players: z.array(playerSummarySchema),
});
export type ManagerClubView = z.infer<typeof managerClubViewSchema>;

export const createClubBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is empty.")
      .max(CLUB_NAME_MAX, `At most ${CLUB_NAME_MAX} characters.`)
      .regex(CLUB_NAME_PATTERN, "Only letters and digits, single spaces between words."),
    cityId: z.number().int().positive(),
    primaryColor: z.enum(CLUB_COLORS),
    secondaryColor: z.enum(CLUB_COLORS),
  })
  .refine((body) => body.primaryColor !== body.secondaryColor, {
    path: ["secondaryColor"],
    message: "The two colours must differ.",
  });
export type CreateClubBody = z.infer<typeof createClubBodySchema>;

export const playerQuerySchema = z.object({ id: z.uuid() });
