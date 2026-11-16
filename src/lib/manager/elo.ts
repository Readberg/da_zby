/**
 * Elo rating of the clubs (DAZBY-155, D-142). The database counts it (`mgr_apply_elo`); this is the
 * same formula for explanations, tests and the check that the two agree.
 * League matches only; start 1000; no goal-difference multiplier.
 */
export const ELO_START = 1000;
/** The first matches of a club move the rating faster. */
export const ELO_K_NEW = 24;
export const ELO_K_SETTLED = 16;
export const ELO_NEW_MATCHES = 20;
/** At the end of a season the rating is pulled this share of the way back to the start. */
export const ELO_SEASON_PULL = 0.2;

export function eloExpected(own: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - own) / 400));
}

export function eloK(ratedMatches: number): number {
  return ratedMatches < ELO_NEW_MATCHES ? ELO_K_NEW : ELO_K_SETTLED;
}

/** The new rating after a match; `score` is 1 for a win, 0.5 for a draw, 0 for a defeat. */
export function eloAfter(
  own: number,
  opponent: number,
  score: 0 | 0.5 | 1,
  ratedMatches: number,
): number {
  return own + Math.round(eloK(ratedMatches) * (score - eloExpected(own, opponent)));
}

/** The rating at the start of the next season. */
export function eloSeasonEnd(elo: number): number {
  return Math.round(elo + (ELO_START - elo) * ELO_SEASON_PULL);
}
