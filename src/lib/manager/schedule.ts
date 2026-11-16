export const LEAGUE_SIZE = 20;
export const ROUNDS = (LEAGUE_SIZE - 1) * 2;

export type Fixture = { round: number; home: number; away: number };

/**
 * Double round robin for 20 clubs (the circle method): 19 rounds, every club meets every other
 * one once, then the same 19 rounds with home and away swapped. 38 rounds, 380 matches. Clubs are
 * numbers 0..19.
 */
export function buildSchedule(size: number = LEAGUE_SIZE): Fixture[] {
  const half = size - 1;
  const first: Fixture[] = [];
  for (let r = 0; r < half; r += 1) {
    // Club 0 stays; the others rotate around it.
    const line = [0, ...Array.from({ length: half }, (_, k) => 1 + ((k + r) % half))];
    for (let i = 0; i < size / 2; i += 1) {
      const a = line[i]!;
      const b = line[size - 1 - i]!;
      // Alternate home and away so no club plays all its matches on one side.
      const flip = i === 0 ? r % 2 === 1 : i % 2 === 1;
      first.push({ round: r + 1, home: flip ? b : a, away: flip ? a : b });
    }
  }
  const second = first.map((f) => ({ round: f.round + half, home: f.away, away: f.home }));
  return [...first, ...second];
}

/** Round 1 starts at the first 10:00 Moscow time (07:00 UTC) that is at least an hour away. */
export function firstKickoff(now: Date): Date {
  const earliest = new Date(now.getTime() + 3_600_000);
  const candidate = new Date(
    Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), earliest.getUTCDate(), 7, 0, 0),
  );
  if (candidate.getTime() < earliest.getTime()) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate;
}
