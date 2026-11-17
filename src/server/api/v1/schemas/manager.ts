import { z } from "zod";
import { FORMATIONS, MENTALITIES } from "@/lib/manager/formations";
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
  budget: z.number().int().describe("Game dollars; negative = in debt (no purchases)."),
  logoUrl: z.string().nullable().describe("The club's own logo, if it has one."),
  dormant: z
    .boolean()
    .describe("The club rests (plays like a bot) until its owner confirms the return."),
  elo: z.number().int().describe("Elo rating (league matches only), start 1000."),
  eloPeak: z.number().int().describe("The highest Elo the club has had."),
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
  injuredUntil: z.string().nullable().describe("ISO 8601, UTC; null or past = fit."),
  nominal: z.number().int().describe("The nominal value, in game dollars."),
  retiring: z.boolean().describe("Retires at the end of the coming season (the owner is warned)."),
  trainingFocus: z.string().nullable().describe("The attribute the player trains; null = rests."),
});
export type PlayerSummary = z.infer<typeof playerSummarySchema>;

export const playerSchema = playerSummarySchema.extend({
  academyClubName: z.string().nullable().describe("The club that made the player."),
  attributes: z.array(z.object({ key: z.string(), value: z.number().int() })),
});
export type Player = z.infer<typeof playerSchema>;

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

// Stage 2: leagues, matches and lineups.

const matchStatusSchema = z.enum(["scheduled", "finished"]);

export const matchSideSchema = z.object({
  clubId: z.uuid(),
  name: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  logoUrl: z.string().nullable(),
});

export const matchSummarySchema = z.object({
  id: z.uuid(),
  round: z.number().int().describe("1–38."),
  kickoffAt: z.string().describe("ISO 8601, UTC. Matches are played at 10:00 Moscow time."),
  status: matchStatusSchema,
  kind: z.enum(["league", "friendly"]).describe("A friendly does not count for the table."),
  home: matchSideSchema,
  away: matchSideSchema,
  homeGoals: z.number().int().nullable(),
  awayGoals: z.number().int().nullable(),
});
export type MatchSummary = z.infer<typeof matchSummarySchema>;

export const matchListSchema = z.object({
  matches: z.array(matchSummarySchema).describe("The matches of my club, by round."),
});
export type MatchList = z.infer<typeof matchListSchema>;

export const matchEventSchema = z.object({
  m: z.number().int().describe("Minute."),
  t: z.enum(["kickoff", "goal", "save", "miss", "injury", "half_time", "full_time"]),
  s: z.enum(["home", "away"]).optional(),
  p: z.string().optional().describe("Surname of the player."),
  a: z.string().optional().describe("Surname of the player who gave the pass."),
  pid: z.string().optional().describe("Id of the player `p` (matches played after DAZBY-153)."),
  aid: z.string().optional().describe("Id of the player `a`."),
});
export type MatchEventData = z.infer<typeof matchEventSchema>;

export const lineupPlayerSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.enum(["GK", "DEF", "MID", "FWD"]),
  real: z.number(),
});
export type LineupPlayerSnapshot = z.infer<typeof lineupPlayerSnapshotSchema>;

export const matchDetailSchema = matchSummarySchema.extend({
  events: z.array(matchEventSchema).describe("The chronicle; empty before the match."),
  homeLineup: z.array(lineupPlayerSnapshotSchema).nullable(),
  awayLineup: z.array(lineupPlayerSnapshotSchema).nullable(),
});
export type MatchDetail = z.infer<typeof matchDetailSchema>;

export const matchQuerySchema = z.object({ id: z.uuid() });

export const tableRowSchema = z.object({
  clubId: z.uuid(),
  name: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  logoUrl: z.string().nullable(),
  isBot: z.boolean(),
  isMine: z.boolean(),
  elo: z.number().int().describe("Elo rating of the club (bots too)."),
  form: z
    .array(z.enum(["W", "D", "L"]))
    .describe("The last 5 results of the club in the league, oldest first."),
  played: z.number().int(),
  won: z.number().int(),
  drawn: z.number().int(),
  lost: z.number().int(),
  goalsFor: z.number().int(),
  goalsAgainst: z.number().int(),
  goalDifference: z.number().int(),
  points: z.number().int(),
});
export type TableRowData = z.infer<typeof tableRowSchema>;

export const leagueViewSchema = z.object({
  league: z
    .object({
      id: z.uuid(),
      number: z.number().int(),
      season: z.number().int(),
      firstKickoffAt: z.string(),
      roundsPlayed: z.number().int().describe("Rounds with every match finished."),
      rounds: z.number().int(),
      phase: z.enum(["season", "preseason"]),
      preseasonEndsAt: z
        .string()
        .nullable()
        .describe("When the next season starts (preseason only)."),
    })
    .nullable()
    .describe("Null while the club has no league yet."),
  table: z.array(tableRowSchema),
});
export type LeagueView = z.infer<typeof leagueViewSchema>;

export const lineupSchema = z.object({
  formation: z.enum(FORMATIONS),
  mentality: z.enum(MENTALITIES),
  playerIds: z.array(z.uuid()).length(11),
  saved: z.boolean().describe("False when the club has not chosen: the best lineup is used."),
  locked: z
    .boolean()
    .describe("True from five minutes before the kickoff of the next match: nothing can change."),
  lockAt: z
    .string()
    .nullable()
    .describe("The moment the lineup stops being accepted: kickoff minus 5 minutes."),
  nextKickoffAt: z.string().nullable(),
});
export type LineupView = z.infer<typeof lineupSchema>;

export const lineupBodySchema = z.object({
  formation: z.enum(FORMATIONS),
  mentality: z.enum(MENTALITIES),
  playerIds: z.array(z.uuid()).length(11, "Choose 11 players."),
});
export type LineupBody = z.infer<typeof lineupBodySchema>;

export const lineupSavedSchema = z.object({ saved: z.literal(true) });

export const cronRoundsSchema = z.object({ played: z.number().int() });

export const managerClubViewSchema = z.object({
  club: managerClubSchema.nullable().describe("Null until the caller has made a club."),
  players: z.array(playerSummarySchema),
  leagueNumber: z.number().int().nullable().describe("Null while the club waits for a league."),
  season: z.number().int().nullable(),
  phase: z.enum(["season", "preseason"]).nullable(),
  preseasonEndsAt: z.string().nullable(),
  nextMatch: matchSummarySchema.nullable().describe("The next match of the club, if any is left."),
});
export type ManagerClubView = z.infer<typeof managerClubViewSchema>;

export const trainingBodySchema = z.object({
  plans: z
    .array(
      z.object({
        playerId: z.uuid(),
        focus: z
          .string()
          .min(1)
          .max(30)
          .nullable()
          .describe("An attribute of the player, or null to rest."),
      }),
    )
    .min(1)
    .max(30),
});
export type TrainingBody = z.infer<typeof trainingBodySchema>;
export const trainingSavedSchema = z.object({ saved: z.literal(true) });

export const returnConfirmedSchema = z.object({
  returned: z.boolean().describe("False when the club was not resting."),
});

export const friendlyCreatedSchema = z.object({ matchId: z.uuid() });

export const transactionSchema = z.object({
  id: z.number().int(),
  amount: z.number().int(),
  reason: z.enum([
    "base",
    "tickets",
    "premium",
    "wages",
    "prize",
    "purchase",
    "sale",
    "tax",
    "trade",
    "penalty",
  ]),
  balanceAfter: z.number().int(),
  createdAt: z.string(),
});

export const financeSchema = z.object({
  budget: z.number().int(),
  squadNominal: z.number().int().describe("The sum of the nominal values of the squad."),
  wagePerRound: z.number().int().describe("What the squad costs in a round of the league."),
  transactions: z.array(transactionSchema).describe("The last operations, newest first."),
});
export type Finance = z.infer<typeof financeSchema>;

export const marketPlayerSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.enum(["GK", "DEF", "MID", "FWD"]),
  age: z.number().int(),
  overall: z.number().int(),
  price: z.number().int().describe("The nominal value: what the club pays."),
});

export const marketSchema = z.object({
  open: z.boolean().describe("The market opens after 10 played matches."),
  matchesPlayed: z.number().int(),
  matchesNeeded: z.number().int(),
  budget: z.number().int(),
  squadSize: z.number().int(),
  squadMax: z.number().int(),
  players: z.array(marketPlayerSchema).describe("The free players of the league this month."),
});
export type Market = z.infer<typeof marketSchema>;

export const buyBodySchema = z.object({ playerId: z.uuid() });
export const boughtSchema = z.object({ budget: z.number().int() });

export const logoBodySchema = z.object({
  path: z
    .string()
    .max(120)
    .nullable()
    .describe("Storage path in the avatars bucket (own folder), or null to remove the logo."),
});
export const logoSavedSchema = z.object({ logoUrl: z.string().nullable() });
