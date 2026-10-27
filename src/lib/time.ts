import type { Locale } from "@/i18n/config";

/** Default display offset: UTC+3 (Minsk), see D-017. */
export const DEFAULT_UTC_OFFSET_MINUTES = 180;

/** Intl locale of each interface language; English uses the 24-hour day-first style of the audience. */
export const INTL_LOCALE: Record<Locale, string> = { ru: "ru-RU", en: "en-GB" };

/**
 * Formats a UTC instant as a calendar date in a fixed UTC offset, e.g. "23 октября 2026" or
 * "23 October 2026". Belarus has no DST, so a fixed offset is exact.
 */
export function formatDate(
  iso: string,
  offsetMinutes = DEFAULT_UTC_OFFSET_MINUTES,
  locale: Locale = "ru",
): string {
  const shifted = new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(shifted)
    .replace(/\s?г\.$/, "");
}
