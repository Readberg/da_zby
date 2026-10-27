import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { dictionaries, type Dictionary } from "./dictionaries";

/**
 * The language of the request being rendered. Layouts and pages call `setRequestLocale()` with the
 * `[locale]` segment first; every component below reads it with `getLocale()` / `getMessages()`
 * without prop drilling. `cache()` gives one store per request (and a fresh one per test).
 */
const store = cache(() => ({ locale: DEFAULT_LOCALE as Locale }));

export function setRequestLocale(locale: Locale): void {
  store().locale = locale;
}

export function getLocale(): Locale {
  return store().locale;
}

export function getMessages(): Dictionary {
  return dictionaries[getLocale()];
}

type LocaleParams = Promise<{ locale: string }>;

/**
 * First line of every page and layout: reads the `[locale]` segment and makes it the request's
 * language. Pages must do it themselves: on a client-side navigation the layout is not rendered
 * again, only the page, so it cannot be left to the layout.
 */
export async function initLocale(params: LocaleParams): Promise<Locale> {
  const { locale } = await params;
  const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
  setRequestLocale(resolved);
  return resolved;
}

/** The dictionary of the page's language, for `generateMetadata`. */
export async function messagesFor(params: LocaleParams): Promise<Dictionary> {
  return dictionaries[await initLocale(params)];
}
