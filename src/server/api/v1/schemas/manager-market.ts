import { z } from "zod";

/** The market between clubs (D-136): the auction, the exchange of players and the contracts. */

const position = z.enum(["GK", "DEF", "MID", "FWD"]);

export const lotPlayerSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  position,
  age: z.number().int(),
  overall: z.number().int(),
});

export const lotSchema = z.object({
  id: z.uuid(),
  player: lotPlayerSchema,
  sellerClubId: z.uuid(),
  sellerName: z.string(),
  mine: z.boolean().describe("My club put the player up."),
  nominal: z.number().int().describe("The nominal value of the player."),
  startPrice: z.number().int(),
  stepPercent: z
    .number()
    .int()
    .describe("10, 20 or 30: how much more than the best bid the next one must be."),
  bidCount: z.number().int(),
  bestBid: z.number().int().nullable(),
  minBid: z.number().int().describe("The least a new bid can be."),
  leading: z.boolean().describe("My club has the best bid."),
  myBid: z.number().int().nullable().describe("The highest bid of my club on the lot."),
  endsAt: z
    .string()
    .describe("The moment of the daily tick (10:00 Moscow time) that settles the lot, ISO 8601."),
});
export type Lot = z.infer<typeof lotSchema>;

export const auctionsSchema = z.object({
  open: z.boolean().describe("The market is open for my club (10 played matches)."),
  budget: z.number().int(),
  squadSize: z.number().int(),
  squadMax: z.number().int(),
  lots: z.array(lotSchema).describe("The open lots of my league, the nearest tick first."),
  maxOpenLots: z.number().int(),
});
export type Auctions = z.infer<typeof auctionsSchema>;

export const listLotBodySchema = z.object({
  playerId: z.uuid(),
  price: z
    .number()
    .int()
    .positive()
    .describe("From half to twice the nominal value of the player."),
  stepPercent: z.union([z.literal(10), z.literal(20), z.literal(30)]),
});
export const lotListedSchema = z.object({ auctionId: z.uuid(), endsAt: z.string() });

export const bidBodySchema = z.object({ auctionId: z.uuid(), amount: z.number().int().positive() });
export const bidPlacedSchema = z.object({ endsAt: z.string() });

export const lotIdBodySchema = z.object({ auctionId: z.uuid() });
export const lotCancelledSchema = z.object({ cancelled: z.boolean() });

// ---- contracts ----------------------------------------------------------------------------------

export const contractPlayerSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  position,
  age: z.number().int(),
  overall: z.number().int(),
  nominal: z.number().int(),
  wage: z.number().int().describe("The wage of a round, fixed when the contract was signed."),
  contractUntil: z.number().int().describe("The last season the contract covers."),
  roundsLeft: z.number().int().describe("The rounds of the league left on the contract."),
  tradableAfter: z
    .string()
    .nullable()
    .describe("A bought or exchanged player cannot be put up before this moment."),
  onAuction: z.boolean(),
  retiring: z.boolean().describe("He retires after the season."),
  canSell: z.boolean(),
  sellBlock: z
    .enum([
      "market_closed",
      "locked",
      "contract_ending",
      "retiring",
      "on_auction",
      "squad_min",
      "lots_limit",
    ])
    .nullable(),
  canExtend: z
    .boolean()
    .describe("An offer is allowed: from half a season to 2 seasons left, one offer a season."),
  breakPenalty: z.number().int().describe("What breaking the contract costs now."),
  priceMin: z.number().int(),
  priceMax: z.number().int(),
});
export type ContractPlayer = z.infer<typeof contractPlayerSchema>;

export const contractsSchema = z.object({
  season: z.number().int(),
  budget: z.number().int(),
  squadSize: z.number().int(),
  squadMin: z.number().int(),
  players: z.array(contractPlayerSchema),
});
export type Contracts = z.infer<typeof contractsSchema>;

export const extendBodySchema = z.object({
  playerId: z.uuid(),
  seasons: z.number().int().min(1).max(3),
});
export const extendedSchema = z.object({
  result: z.enum(["accepted", "refused"]),
});
export const terminateBodySchema = z.object({ playerId: z.uuid() });
export const terminatedSchema = z.object({ penalty: z.number().int() });

// ---- exchange -----------------------------------------------------------------------------------

export const tradePlayerSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  position,
  age: z.number().int(),
  overall: z.number().int(),
  nominal: z.number().int(),
  locked: z
    .boolean()
    .describe("Cannot be exchanged now: the week after a purchase, an ending contract, a lot."),
});

export const tradeSchema = z.object({
  id: z.uuid(),
  incoming: z.boolean().describe("The offer is to my club (it can accept or decline)."),
  fromClubId: z.uuid(),
  fromClubName: z.string(),
  toClubId: z.uuid(),
  toClubName: z.string(),
  give: z.array(tradePlayerSchema).describe("What the proposing club gives."),
  take: z.array(tradePlayerSchema).describe("What the proposing club takes."),
  cash: z.number().int().describe("Positive: the proposer pays on top. Negative: he gets it."),
  status: z.enum(["pending", "accepted", "declined", "cancelled", "expired"]),
  createdAt: z.string(),
  expiresAt: z.string(),
});
export type Trade = z.infer<typeof tradeSchema>;

export const tradesSchema = z.object({
  open: z.boolean(),
  budget: z.number().int(),
  squad: z.array(tradePlayerSchema).describe("The players of my club."),
  clubs: z
    .array(z.object({ id: z.uuid(), name: z.string() }))
    .describe("The other clubs of my league run by people."),
  trades: z.array(tradeSchema).describe("Pending offers first, then the last resolved ones."),
});
export type Trades = z.infer<typeof tradesSchema>;

export const clubSquadSchema = z.object({
  club: z.object({ id: z.uuid(), name: z.string() }),
  players: z.array(tradePlayerSchema),
});
export type ClubSquad = z.infer<typeof clubSquadSchema>;

export const proposeTradeBodySchema = z.object({
  toClubId: z.uuid(),
  give: z.array(z.uuid()).min(1).max(3),
  take: z.array(z.uuid()).min(1).max(3),
  cash: z
    .number()
    .int()
    .describe(
      "Positive: I pay on top. Negative: I get it. At most twice the value of what the payer receives.",
    ),
});
export const tradeProposedSchema = z.object({ tradeId: z.uuid() });
export const tradeIdBodySchema = z.object({ tradeId: z.uuid() });
export const tradeDoneSchema = z.object({ done: z.boolean() });
