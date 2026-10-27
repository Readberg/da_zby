import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import type { getMessages } from "@/i18n/server";

const OPEN_GRAPH_LOCALE = { ru: "ru_RU", en: "en_US" } as const;

/**
 * The site-wide Open Graph card. `url` is given only by a page that really is that address (the
 * home page): a shared `og:url` of "/" on every page made link previews point at the home page.
 */
export function siteOpenGraph(
  locale: Locale,
  t: ReturnType<typeof getMessages>,
  url?: string,
): NonNullable<Metadata["openGraph"]> {
  return {
    type: "website",
    locale: OPEN_GRAPH_LOCALE[locale],
    siteName: t.site.name,
    title: t.site.name,
    description: t.site.description,
    ...(url ? { url } : {}),
  };
}
