/**
 * Money of the football manager (D-129, D-133, docs/MANAGER.md and docs/ECONOMY.md). One currency,
 * the game dollar: it is not real money. The numbers are the starting ones of the brief; the
 * simulation of seasons (scripts/simulate-economy.ts) checks them.
 */
export const START_BUDGET = 10_000;

/** A home match: the tickets. */
export const TICKET_INCOME = 120;
/** For a result: a win and a draw. */
export const WIN_BONUS = 60;
export const DRAW_BONUS = 20;
/** Every round, home or away. */
export const BASE_INCOME = 20;
/** The wage of a round, as a share of the nominal values of the squad. */
export const WAGE_RATE = 0.005;

/** The tax on what a seller receives, and the most a seller can receive (in nominal values). */
export const SALE_TAX = 0.1;
export const PAYOUT_CAP_NOMINALS = 2;

/** A squad has 17 to 23 players; the market opens after 10 played matches. */
export const SQUAD_MIN = 17;
export const SQUAD_MAX = 23;
export const MARKET_OPENS_AFTER_MATCHES = 10;

/** Younger and stronger players cost more. */
export function ageFactor(age: number): number {
  if (age <= 21) return 1.3;
  if (age <= 26) return 1;
  if (age <= 29) return 0.8;
  if (age <= 32) return 0.55;
  return 0.3;
}

/** The nominal value ("номинал") of a player: V = 1000 · 1.12^(OVR − 60) · k_age. */
export function nominalValue(ovr: number, age: number): number {
  return Math.round(1000 * 1.12 ** (ovr - 60) * ageFactor(age));
}

/** The wage of a round fixed in a contract: a share of the nominal value on the day it is signed. */
export function contractWage(ovr: number, age: number): number {
  return Math.round(nominalValue(ovr, age) * WAGE_RATE);
}

/**
 * What a club pays its players in a round: the wages fixed in their contracts (a player without
 * one, e.g. in a test, costs the share of his nominal value today).
 */
export function roundWages(players: { ovr: number; age: number; wage?: number | null }[]): number {
  return players.reduce((sum, p) => sum + (p.wage || contractWage(p.ovr, p.age)), 0);
}

export type Outcome = "win" | "draw" | "loss";

export type MoneyEntry = {
  reason: "base" | "tickets" | "premium" | "wages";
  amount: number;
};

/** What a club earns and pays for one round of the league. */
export function roundMoney(input: {
  home: boolean;
  outcome: Outcome;
  squad: { ovr: number; age: number; wage?: number | null }[];
}): MoneyEntry[] {
  const entries: MoneyEntry[] = [{ reason: "base", amount: BASE_INCOME }];
  if (input.home) entries.push({ reason: "tickets", amount: TICKET_INCOME });
  if (input.outcome === "win") entries.push({ reason: "premium", amount: WIN_BONUS });
  if (input.outcome === "draw") entries.push({ reason: "premium", amount: DRAW_BONUS });
  entries.push({ reason: "wages", amount: -roundWages(input.squad) });
  return entries;
}

/** The prize of a season for the place in the table (1 to 20): 4000 for the 1st, 200 for the 20th. */
export function seasonPrize(place: number): number {
  return Math.round((4000 * (21 - place)) / 20);
}

/** What a seller gets for a price: the tax is taken, and he never gets more than the cap. */
export function sellerProceeds(price: number, nominal: number): { tax: number; payout: number } {
  const tax = Math.round(price * SALE_TAX);
  const payout = Math.min(price - tax, Math.round(nominal * PAYOUT_CAP_NOMINALS));
  return { tax, payout };
}

/** The market (D-136): lots, bids, exchanges and contracts. */
export const AUCTION_STEPS = [10, 20, 30] as const;
export const AUCTION_PRICE_MIN = 0.5;
export const AUCTION_PRICE_MAX = 2;
export const MAX_OPEN_LOTS = 5;
export const MAX_OPEN_OFFERS = 5;
/** A bought or exchanged player cannot be put up again for a week. */
export const RESALE_BAN_DAYS = 7;
/** A league has 38 rounds a season. */
export const ROUNDS_PER_SEASON = 38;
/** A contract can be extended with 0.5 to 2 seasons left; a player with under 0.5 is not for sale. */
export const EXTEND_MIN_ROUNDS = 19;
export const EXTEND_MAX_ROUNDS = 76;
/** Breaking a contract costs this share of the wages of the rounds left. */
export const BREAK_PENALTY_SHARE = 2 / 3;

/** The lowest bid: the start price, then the best bid plus the step (at least 1). */
export function minNextBid(
  startPrice: number,
  bestBid: number | null,
  stepPercent: number,
): number {
  if (bestBid === null) return startPrice;
  return bestBid + Math.max(1, Math.ceil((bestBid * stepPercent) / 100));
}

/** The prices a lot may start from, for a nominal value. */
export function startPriceRange(nominal: number): { min: number; max: number } {
  return {
    min: Math.round(nominal * AUCTION_PRICE_MIN),
    max: Math.round(nominal * AUCTION_PRICE_MAX),
  };
}

/** What a club pays to break a contract with this many rounds left. */
export function breakPenalty(roundsLeft: number, wage: number): number {
  return Math.round(roundsLeft * wage * BREAK_PENALTY_SHARE);
}
