/** Default display offset: UTC+3 (Minsk), see D-017. */
export const DEFAULT_UTC_OFFSET_MINUTES = 180;

/**
 * Formats a UTC instant as a Russian calendar date in a fixed UTC offset,
 * e.g. "23 октября 2026". Belarus has no DST, so a fixed offset is exact.
 */
export function formatDate(iso: string, offsetMinutes = DEFAULT_UTC_OFFSET_MINUTES): string {
  const shifted = new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(shifted)
    .replace(/\s?г\.$/, "");
}
