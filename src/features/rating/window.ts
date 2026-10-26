/** How many rows from the top are always shown, and how many neighbours each side of "me" a click adds (D-084). */
export const TOP_ROWS = 20;
export const NEIGHBOURS = 5;

export type RatingWindow<T> = {
  /** The rows to draw, in their original order. */
  rows: T[];
  /** How many rows are skipped right before the row with this `userId`. */
  gapBefore: Record<string, number>;
  /** How many rows are skipped after the last drawn row. */
  gapAfter: number;
  /** True while the click "show neighbours" would reveal rows around the viewer. */
  canExpand: boolean;
};

/**
 * Cuts a long table down to the top and the viewer's own row. With `expanded` the rows around the
 * viewer are added too. The input is the full ordered table; nothing is reordered.
 */
export function windowRows<T extends { userId: string }>(
  all: T[],
  viewerId: string | null | undefined,
  expanded: boolean,
): RatingWindow<T> {
  const mine = viewerId ? all.findIndex((row) => row.userId === viewerId) : -1;
  const visible = new Set<number>();
  for (let i = 0; i < Math.min(TOP_ROWS, all.length); i++) visible.add(i);

  let canExpand = false;
  if (mine >= 0) {
    visible.add(mine);
    const from = Math.max(0, mine - NEIGHBOURS);
    const to = Math.min(all.length - 1, mine + NEIGHBOURS);
    for (let i = from; i <= to; i++) {
      if (visible.has(i)) continue;
      if (expanded) visible.add(i);
      else canExpand = true;
    }
  }

  const indexes = [...visible].sort((a, b) => a - b);
  const gapBefore: Record<string, number> = {};
  let previous = -1;
  for (const index of indexes) {
    if (index - previous > 1) gapBefore[all[index].userId] = index - previous - 1;
    previous = index;
  }

  return {
    rows: indexes.map((index) => all[index]),
    gapBefore,
    gapAfter: all.length - 1 - previous,
    canExpand,
  };
}
