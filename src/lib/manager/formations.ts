import type { Position } from "./attributes";

/**
 * Lineup rules of the football manager (D-129, D-145): one goalkeeper and ten outfield players.
 * Each formation lists its rows from the own goal to the opponent's: the pitch draws them as they
 * are (4-2-3-1 has two midfield rows), the engine and the database only count the players of each
 * position (DEF / MID / FWD).
 */
const LAYOUT = {
  "3-4-3": { DEF: [3], MID: [4], FWD: [3] },
  "3-5-2": { DEF: [3], MID: [5], FWD: [2] },
  "3-4-1-2": { DEF: [3], MID: [4, 1], FWD: [2] },
  "4-4-2": { DEF: [4], MID: [4], FWD: [2] },
  "4-3-3": { DEF: [4], MID: [3], FWD: [3] },
  "4-5-1": { DEF: [4], MID: [5], FWD: [1] },
  "4-2-3-1": { DEF: [4], MID: [2, 3], FWD: [1] },
  "4-1-4-1": { DEF: [4], MID: [1, 4], FWD: [1] },
  "4-4-1-1": { DEF: [4], MID: [4], FWD: [1, 1] },
  "5-3-2": { DEF: [5], MID: [3], FWD: [2] },
  "5-4-1": { DEF: [5], MID: [4], FWD: [1] },
  "5-2-3": { DEF: [5], MID: [2], FWD: [3] },
} as const satisfies Record<string, Record<"DEF" | "MID" | "FWD", readonly number[]>>;

export type Formation = keyof typeof LAYOUT;
/** In the order of the choice list: grouped by the number of defenders. */
export const FORMATIONS = Object.keys(LAYOUT) as Formation[];

/** The formations of each group of the choice list: by the number of defenders. */
export const FORMATION_GROUPS: { defenders: number; formations: Formation[] }[] = [3, 4, 5].map(
  (defenders) => ({
    defenders,
    formations: FORMATIONS.filter((f) => LAYOUT[f].DEF[0] === defenders),
  }),
);

/** The rows of a position on the pitch, from the own goal forward. */
export function formationRows(formation: Formation, position: "DEF" | "MID" | "FWD"): number[] {
  return [...LAYOUT[formation][position]];
}

/**
 * The mentality (D-145): seven steps from -3 (park the bus) to +3 (all out attack). The scale of the
 * effect is in the engine (temporary, set while the balance is worked out).
 */
export const MENTALITIES = [
  "bus",
  "defensive",
  "cautious",
  "balanced",
  "offensive",
  "attacking",
  "all_out",
] as const;
export type Mentality = (typeof MENTALITIES)[number];

/** -3 … +3: how far the mentality leans to the attack. */
export function mentalityLevel(mentality: Mentality): number {
  return MENTALITIES.indexOf(mentality) - 3;
}

export const LINEUP_SIZE = 11;

/** How many players of each position a formation needs. */
export function formationCounts(formation: Formation): Record<Position, number> {
  const sum = (rows: readonly number[]) => rows.reduce((a, b) => a + b, 0);
  const layout = LAYOUT[formation];
  return { GK: 1, DEF: sum(layout.DEF), MID: sum(layout.MID), FWD: sum(layout.FWD) };
}

export type RatedPlayer = { id: string; position: Position; real: number };

/**
 * The best lineup a squad can field: for every formation the strongest players of each position,
 * and the formation whose eleven add up to the most. Used for clubs that sent no lineup (and for
 * bots), so there is no penalty for not choosing.
 */
export function autoLineup(players: RatedPlayer[]): {
  formation: Formation;
  mentality: Mentality;
  playerIds: string[];
} | null {
  const byPosition = (position: Position) =>
    players
      .filter((p) => p.position === position)
      .sort((a, b) => b.real - a.real || a.id.localeCompare(b.id));

  let best: { formation: Formation; ids: string[]; total: number } | null = null;
  for (const formation of FORMATIONS) {
    const need = formationCounts(formation);
    const picked: RatedPlayer[] = [];
    let feasible = true;
    for (const position of ["GK", "DEF", "MID", "FWD"] as const) {
      const pool = byPosition(position);
      if (pool.length < need[position]) {
        feasible = false;
        break;
      }
      picked.push(...pool.slice(0, need[position]));
    }
    if (!feasible) continue;
    const total = picked.reduce((sum, p) => sum + p.real, 0);
    if (!best || total > best.total) {
      best = { formation, ids: picked.map((p) => p.id), total };
    }
  }
  return best ? { formation: best.formation, mentality: "balanced", playerIds: best.ids } : null;
}

/** Does this set of players fill the formation exactly (1 GK and the line counts)? */
export function lineupFits(formation: Formation, players: { position: Position }[]): boolean {
  if (players.length !== LINEUP_SIZE) return false;
  const need = formationCounts(formation);
  return (["GK", "DEF", "MID", "FWD"] as const).every(
    (position) => players.filter((p) => p.position === position).length === need[position],
  );
}
