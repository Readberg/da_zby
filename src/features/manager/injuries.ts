/** Is a player hurt right now? (`injuredUntil` is an ISO time or null.) */
export function isInjuredNow(injuredUntil: string | null): boolean {
  return injuredUntil !== null && new Date(injuredUntil).getTime() > Date.now();
}

/** The ready note ("injured until …") of every player who is hurt now, by player id. */
export function injuredNotes(
  players: { id: string; injuredUntil: string | null }[],
  note: (injuredUntil: string) => string,
): Record<string, string> {
  return Object.fromEntries(
    players.filter((p) => isInjuredNow(p.injuredUntil)).map((p) => [p.id, note(p.injuredUntil!)]),
  );
}
