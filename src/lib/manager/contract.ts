import {
  EXTEND_MAX_ROUNDS,
  EXTEND_MIN_ROUNDS,
  MAX_OPEN_LOTS,
  ROUNDS_PER_SEASON,
  SQUAD_MIN,
} from "./economy";

/** The rounds of the league left on a contract: what is left of this season and whole seasons after it. */
export function contractRoundsLeft(input: {
  contractUntil: number;
  season: number;
  playedThisSeason: number;
}): number {
  const thisSeason = ROUNDS_PER_SEASON - input.playedThisSeason;
  return Math.max(0, thisSeason + ROUNDS_PER_SEASON * (input.contractUntil - input.season));
}

export type SellBlock =
  | "market_closed"
  | "locked"
  | "contract_ending"
  | "retiring"
  | "on_auction"
  | "squad_min"
  | "lots_limit";

/** Why a player cannot be put up now (the first reason), or null. The database decides; this explains. */
export function sellBlock(input: {
  marketOpen: boolean;
  onAuction: boolean;
  retiring: boolean;
  tradableAfter: Date | null;
  roundsLeft: number;
  openLots: number;
  squadSize: number;
  now: Date;
}): SellBlock | null {
  if (!input.marketOpen) return "market_closed";
  if (input.onAuction) return "on_auction";
  if (input.retiring) return "retiring";
  if (input.tradableAfter && input.tradableAfter.getTime() > input.now.getTime()) return "locked";
  if (input.roundsLeft < EXTEND_MIN_ROUNDS) return "contract_ending";
  if (input.openLots >= MAX_OPEN_LOTS) return "lots_limit";
  if (input.squadSize - input.openLots - 1 < SQUAD_MIN) return "squad_min";
  return null;
}

/** A new contract can be offered with from half a season to 2 seasons left, once a season. */
export function canOfferContract(
  roundsLeft: number,
  offerSeason: number | null,
  season: number,
): boolean {
  return (
    roundsLeft >= EXTEND_MIN_ROUNDS && roundsLeft <= EXTEND_MAX_ROUNDS && offerSeason !== season
  );
}
