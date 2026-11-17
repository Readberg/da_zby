import type { Position } from "./attributes";
import { formationRows, type Formation } from "./formations";

/**
 * The lineup on the pitch: 11 places (a goalkeeper and the lines of the formation) that a player
 * of the same position can take. Pure functions, so that dragging, clicking and the keyboard all
 * change the lineup by the same rules.
 */
export type Slot = {
  id: string;
  position: Position;
  /** Place on the pitch in percent: x from the left, y from the top (the goal is at the bottom). */
  x: number;
  y: number;
};

export type PitchPlayer = { id: string; position: Position; real: number; injured?: boolean };

/** Slot id -> player id. */
export type Assignment = Record<string, string>;

const LINE_Y: Record<Position, number> = { GK: 88, DEF: 67, MID: 44, FWD: 20 };
const ORDER: Position[] = ["GK", "DEF", "MID", "FWD"];

/** Distance between two rows of the same line (4-2-3-1 has two midfield rows), in percent. */
const ROW_STEP = 11;

export function pitchSlots(formation: Formation): Slot[] {
  const slots: Slot[] = [{ id: "GK-0", position: "GK", x: 50, y: LINE_Y.GK }];
  for (const position of ["DEF", "MID", "FWD"] as const) {
    const rows = formationRows(formation, position);
    let index = 0;
    rows.forEach((count, row) => {
      // The first row is the one nearer to the own goal (lower on the pitch).
      const y = LINE_Y[position] + ((rows.length - 1) / 2 - row) * ROW_STEP;
      for (let i = 0; i < count; i += 1) {
        slots.push({
          id: `${position}-${index}`,
          position,
          x: Math.round(((i + 1) / (count + 1)) * 1000) / 10,
          y,
        });
        index += 1;
      }
    });
  }
  return slots;
}

const best = (a: PitchPlayer, b: PitchPlayer) => b.real - a.real || a.id.localeCompare(b.id);

/**
 * Puts players into the places of a formation: the given ones first, in their order, then the best
 * fit players of the position for the places that are still empty.
 */
export function assign(
  formation: Formation,
  preferred: string[],
  players: PitchPlayer[],
): Assignment {
  const byId = new Map(players.map((p) => [p.id, p]));
  const used = new Set<string>();
  const assignment: Assignment = {};
  const slots = pitchSlots(formation);

  for (const position of ORDER) {
    const line = slots.filter((s) => s.position === position);
    const wanted = preferred
      .map((id) => byId.get(id))
      .filter((p): p is PitchPlayer => Boolean(p) && p!.position === position && !p!.injured);
    const extra = players.filter((p) => p.position === position && !p.injured).sort(best);
    const queue = [...wanted, ...extra].filter((p, i, all) => all.indexOf(p) === i);
    for (const slot of line) {
      const next = queue.find((p) => !used.has(p.id));
      if (next) {
        assignment[slot.id] = next.id;
        used.add(next.id);
      }
    }
  }
  return assignment;
}

/** The ids of the eleven, in the order of the places. */
export function lineupIds(formation: Formation, assignment: Assignment): string[] {
  return pitchSlots(formation)
    .map((slot) => assignment[slot.id])
    .filter((id): id is string => Boolean(id));
}

export function slotOf(assignment: Assignment, playerId: string): string | null {
  return Object.keys(assignment).find((slotId) => assignment[slotId] === playerId) ?? null;
}

/** Players who are not in the lineup. */
export function benchOf(assignment: Assignment, players: PitchPlayer[]): PitchPlayer[] {
  const used = new Set(Object.values(assignment));
  return players.filter((p) => !used.has(p.id));
}

/**
 * Puts a player on a place. Only a player of the same position fits, and an injured one never. The
 * player who was there goes to the bench, or, when the newcomer came from the pitch, takes the
 * place the newcomer left. Returns null when the move is not allowed.
 */
export function place(
  formation: Formation,
  assignment: Assignment,
  players: PitchPlayer[],
  slotId: string,
  playerId: string,
): Assignment | null {
  const slot = pitchSlots(formation).find((s) => s.id === slotId);
  const player = players.find((p) => p.id === playerId);
  if (!slot || !player || player.injured || slot.position !== player.position) return null;
  if (assignment[slotId] === playerId) return assignment;

  const next = { ...assignment };
  const displaced = assignment[slotId];
  const from = slotOf(assignment, playerId);
  next[slotId] = playerId;
  if (from) {
    if (displaced) next[from] = displaced;
    else delete next[from];
  }
  return next;
}

/** A new formation: each line keeps its players (the first ones), the missing places get the best from the bench. */
export function reshape(
  formation: Formation,
  assignment: Assignment,
  players: PitchPlayer[],
  previous: Formation,
): Assignment {
  const previousSlots = pitchSlots(previous);
  const kept = previousSlots.map((s) => assignment[s.id]).filter((id): id is string => Boolean(id));
  return assign(formation, kept, players);
}
