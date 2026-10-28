import type { Locale } from "@/i18n/config";
import { DEFAULT_UTC_OFFSET_MINUTES, INTL_LOCALE } from "./time";

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Value of an `<input type="datetime-local">` (wall-clock time in the user's fixed UTC offset)
 * to a UTC ISO string. Returns null for an empty or malformed value.
 */
export function localInputToUtcIso(
  value: string,
  offsetMinutes = DEFAULT_UTC_OFFSET_MINUTES,
): string | null {
  const match = LOCAL_INPUT.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const utc = Date.UTC(y, mo - 1, d, h, mi) - offsetMinutes * 60_000;
  const date = new Date(utc);
  // Reject impossible dates such as 2026-02-31 (Date.UTC would roll them over).
  const shifted = new Date(utc + offsetMinutes * 60_000);
  if (shifted.getUTCMonth() !== mo - 1 || shifted.getUTCDate() !== d) return null;
  return date.toISOString();
}

/** UTC ISO string to the value for `<input type="datetime-local">` in the given offset. */
export function utcIsoToLocalInput(
  iso: string | null | undefined,
  offsetMinutes = DEFAULT_UTC_OFFSET_MINUTES,
): string {
  if (!iso) return "";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  return new Date(time + offsetMinutes * 60_000).toISOString().slice(0, 16);
}

/** "25 октября в 18:30" / "25 October at 18:30" in the given offset, for lists and match rows. */
export function formatDateTime(
  iso: string,
  offsetMinutes = DEFAULT_UTC_OFFSET_MINUTES,
  locale: Locale = "ru",
): string {
  const shifted = new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(shifted);
}

/** "19:00" in the given offset: the kickoff time alone, for match cards. */
export function formatTimeOfDay(
  iso: string,
  offsetMinutes = DEFAULT_UTC_OFFSET_MINUTES,
  locale: Locale = "ru",
): string {
  const shifted = new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(shifted);
}

/** "31 октября" / "31 October" in the given offset: the day of the month alone. */
export function formatDayMonth(
  iso: string,
  offsetMinutes = DEFAULT_UTC_OFFSET_MINUTES,
  locale: Locale = "ru",
): string {
  const shifted = new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(shifted);
}
