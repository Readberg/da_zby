import type { Locale } from "@/i18n/config";
import { formatDayMonth } from "./local-time";

const DAY_MS = 86_400_000;

/** The calendar day of an instant in the viewer's offset, "2026-10-29": messages are grouped by it. */
export function dayKey(iso: string | number, offsetMinutes: number): string {
  return new Date(new Date(iso).getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** "Today", "Yesterday" or "26 October": what the separator above a day's messages says. */
export function dayLabel(
  iso: string,
  now: number,
  offsetMinutes: number,
  locale: Locale,
  words: { today: string; yesterday: string },
): string {
  const key = dayKey(iso, offsetMinutes);
  if (key === dayKey(now, offsetMinutes)) return words.today;
  if (key === dayKey(now - DAY_MS, offsetMinutes)) return words.yesterday;
  return formatDayMonth(iso, offsetMinutes, locale);
}
