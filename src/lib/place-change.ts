export type Standing = {
  userId: string;
  points: number;
  exactCount: number;
  outcomeCount: number;
  predictionsCount: number;
};

/** Competition ranking by the tournament rule: points, exact scores, outcomes; equal results share a place. */
function rank(rows: Standing[]): Map<string, number> {
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || b.exactCount - a.exactCount || b.outcomeCount - a.outcomeCount,
  );
  const places = new Map<string, number>();
  sorted.forEach((row, index) => {
    const prev = sorted[index - 1];
    const tied =
      prev &&
      prev.points === row.points &&
      prev.exactCount === row.exactCount &&
      prev.outcomeCount === row.outcomeCount;
    places.set(row.userId, tied ? (places.get(prev.userId) as number) : index + 1);
  });
  return places;
}

/**
 * How many places each participant gained with the latest graded tour: the season table before that
 * tour (season totals minus the tour's own) against the table now. Positive: rose. Participants
 * whose first predictions are in that tour have no change.
 */
export function placeChanges(season: Standing[], lastTour: Standing[]): Map<string, number> {
  const tourOf = new Map(lastTour.map((row) => [row.userId, row]));
  const before = season.map((row) => {
    const t = tourOf.get(row.userId);
    return t
      ? {
          ...row,
          points: row.points - t.points,
          exactCount: row.exactCount - t.exactCount,
          outcomeCount: row.outcomeCount - t.outcomeCount,
          predictionsCount: row.predictionsCount - t.predictionsCount,
        }
      : row;
  });
  const now = rank(season);
  const was = rank(before);
  const changes = new Map<string, number>();
  for (const row of before) {
    if (row.predictionsCount <= 0) continue;
    changes.set(row.userId, (was.get(row.userId) as number) - (now.get(row.userId) as number));
  }
  return changes;
}
