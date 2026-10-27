import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

export type Routing =
  | { kind: "pass" }
  | { kind: "redirect"; path: string }
  | { kind: "rewrite"; path: string; locale: Locale };

/** Paths that are not pages: route handlers and generated preview images keep their addresses. */
const NOT_PAGES = /^\/(api|auth)(\/|$)|\/opengraph-image/;
/** The admin section is Russian only (D-088): the cookie does not apply there. */
const RUSSIAN_ONLY = /^\/admin(\/|$)/;

/**
 * Where a request goes. Pages live under `/[locale]/…` but visitors never see that: an address
 * like `/rating` is rewritten to `/ru/rating` or `/en/rating` by the visitor's cookie, and an
 * address that already starts with a language is sent to its plain form.
 */
export function routeRequest(pathname: string, cookieValue: string | undefined): Routing {
  if (NOT_PAGES.test(pathname)) return { kind: "pass" };

  const [, first = "", ...rest] = pathname.split("/");
  if (isLocale(first)) {
    const tail = rest.join("/");
    return { kind: "redirect", path: tail ? `/${tail}` : "/" };
  }

  const locale = RUSSIAN_ONLY.test(pathname)
    ? DEFAULT_LOCALE
    : isLocale(cookieValue)
      ? cookieValue
      : DEFAULT_LOCALE;
  return {
    kind: "rewrite",
    locale,
    path: pathname === "/" ? `/${locale}` : `/${locale}${pathname}`,
  };
}
