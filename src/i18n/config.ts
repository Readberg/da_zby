/** Interface languages (D-088). Russian is the source of the texts and the default. */
export const LOCALES = ["ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";

/** Cookie with the visitor's choice; the address never carries the language. */
export const LOCALE_COOKIE = "lang";
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Names of the languages in their own language: the same in every interface language. */
export const LOCALE_NAMES: Record<Locale, string> = { ru: "Русский", en: "English" };
