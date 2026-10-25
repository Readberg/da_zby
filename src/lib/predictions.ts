import { z } from "zod";

/** Prediction rules shared by the page (browser/server) and the API; the database enforces them again. */

/** A tour accepts predictions until this long before its first match (matches `tour_deadline()`). */
export const DEADLINE_LEAD_MS = 10 * 60 * 1000;

type MatchTime = { kickoffAt: string; status: string };

/**
 * Effective deadline of a tour: the pinned one, else 10 minutes before the first match that is
 * not cancelled; null while the tour has no such match.
 */
export function tourDeadline(override: string | null, matches: MatchTime[]): Date | null {
  if (override) return new Date(override);
  const kickoffs = matches
    .filter((match) => match.status !== "cancelled")
    .map((match) => new Date(match.kickoffAt).getTime());
  if (kickoffs.length === 0) return null;
  return new Date(Math.min(...kickoffs) - DEADLINE_LEAD_MS);
}

/** Predictions are open while the season is active and the deadline has not passed. */
export function isTourOpen(
  seasonStatus: string,
  deadline: Date | null,
  now: Date = new Date(),
): boolean {
  return seasonStatus === "active" && deadline !== null && now < deadline;
}

/** One match accepts a prediction while it has not been played or cancelled (see `can_predict`). */
export function isMatchOpen(status: string): boolean {
  return status === "scheduled" || status === "postponed";
}

/**
 * The tour to open by default: the first one (by number) whose deadline has not passed yet; when
 * all have passed, the last one; tours without matches are skipped unless nothing else is left.
 */
export function pickCurrentTour<T extends { number: number; deadline: Date | null }>(
  tours: T[],
  now: Date = new Date(),
): T | null {
  if (tours.length === 0) return null;
  const sorted = [...tours].sort((a, b) => a.number - b.number);
  const upcoming = sorted.find((tour) => tour.deadline !== null && tour.deadline > now);
  if (upcoming) return upcoming;
  const withMatches = sorted.filter((tour) => tour.deadline !== null);
  return withMatches.at(-1) ?? sorted.at(-1) ?? null;
}

const score = z.number().int("Целое число").min(0, "От 0").max(99, "До 99");

export const predictionItemSchema = z.object({
  matchId: z.uuid("Некорректный id"),
  homeScore: score,
  awayScore: score,
});

export const predictionsBodySchema = z.object({
  tourId: z.uuid("Некорректный id"),
  items: z.array(predictionItemSchema).min(1, "Нечего сохранять").max(50, "Слишком много матчей"),
});
export type PredictionsBody = z.infer<typeof predictionsBodySchema>;
