import type { Position } from "./attributes";

/** Lineup rules of the football manager (D-129): one goalkeeper and ten outfield players. */
export const FORMATIONS = ["4-4-2", "4-3-3", "3-5-2", "4-5-1", "5-3-2"] as const;
export type Formation = (typeof FORMATIONS)[number];

export const MENTALITIES = ["balanced", "attack", "defense"] as const;
export type Mentality = (typeof MENTALITIES)[number];

export const LINEUP_SIZE = 11;

/** How many players of each position a formation needs. */
export function formationCounts(formation: Formation): Record<Position, number> {
  const [def, mid, fwd] = formation.split("-").map(Number) as [number, number, number];
  return { GK: 1, DEF: def, MID: mid, FWD: fwd };
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
