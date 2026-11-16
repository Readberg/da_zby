import { z } from "zod";

// Player statistics (DAZBY-153).

const positionSchema = z.enum(["GK", "DEF", "MID", "FWD"]);

export const statLineSchema = z.object({
  matches: z.number().int(),
  goals: z.number().int(),
  assists: z.number().int(),
  shots: z.number().int(),
  shotsOnTarget: z.number().int(),
  injuries: z.number().int(),
  cleanSheets: z.number().int().describe("Goalkeepers only."),
});
export type StatLine = z.infer<typeof statLineSchema>;

export const playerStatsSchema = z.object({
  playerId: z.uuid(),
  name: z.string(),
  position: positionSchema,
  seasons: z
    .array(statLineSchema.extend({ season: z.number().int(), clubName: z.string() }))
    .describe("One line per season and club, the latest season first."),
  career: statLineSchema,
});
export type PlayerStats = z.infer<typeof playerStatsSchema>;

export const scorersSchema = z.object({
  season: z.number().int().nullable().describe("Null while the club has no league."),
  scorers: z.array(
    statLineSchema.extend({
      playerId: z.uuid(),
      name: z.string(),
      position: positionSchema,
      clubId: z.uuid(),
      clubName: z.string(),
      isMine: z.boolean(),
    }),
  ),
});
export type Scorers = z.infer<typeof scorersSchema>;
