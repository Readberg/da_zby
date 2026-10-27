import type { Locale } from "@/i18n/config";

/** Russian plural form: pluralRu(1, ["очко", "очка", "очков"]) → "очко"; 2 → "очка"; 5 → "очков". */
export function pluralRu(count: number, forms: readonly [string, string, string]): string {
  const n = Math.abs(Math.trunc(count));
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/**
 * The plural form of a word in the page's language. Dictionaries keep three forms for every
 * language: Russian uses all three, English uses the first for 1 and the last otherwise.
 */
export function plural(locale: Locale, count: number, forms: readonly [string, string, string]) {
  if (locale === "ru") return pluralRu(count, forms);
  return Math.abs(Math.trunc(count)) === 1 ? forms[0] : forms[2];
}

const POINTS: Record<Locale, readonly [string, string, string]> = {
  ru: ["очко", "очка", "очков"],
  en: ["point", "points", "points"],
};

/** The word after a number of points: "очка", "points". */
export function pointsWord(count: number, locale: Locale = "ru"): string {
  return plural(locale, count, POINTS[locale]);
}

/** "3 очка", "1 очко", "5 очков"; in English "3 points", "1 point". */
export function points(count: number, locale: Locale = "ru"): string {
  return `${count} ${pointsWord(count, locale)}`;
}
