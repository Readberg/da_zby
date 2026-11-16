/** How long is left, for a timer: "2 д 03:04:05" from a day on, "03:04:05" below, never negative. */
export function formatTimeLeft(ms: number, dayLabel: string = "d"): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
  return days > 0 ? `${days} ${dayLabel} ${clock}` : clock;
}

/** The lineups of a club are accepted until this long before the kickoff. */
export const LINEUP_DEADLINE_MS = 5 * 60_000;

/** The moment after which a lineup is not accepted: five minutes before the kickoff. */
export function lineupDeadline(kickoffIso: string): Date {
  return new Date(new Date(kickoffIso).getTime() - LINEUP_DEADLINE_MS);
}
