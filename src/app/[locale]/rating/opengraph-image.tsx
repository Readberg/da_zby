import { renderCard } from "@/lib/og-card";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-theme";
import { points } from "@/lib/plural";
import { dictionaries } from "@/i18n/dictionaries";
import { initLocale } from "@/i18n/server";
import { getRatingPageCached } from "@/server/services/rating.cached";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Link preview of the standings: the top three of the current season (D-091). */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await initLocale(params);
  // Route handlers have no per-request store, so the dictionary is taken by the language directly.
  const t = dictionaries[locale];
  const data = await getRatingPageCached(undefined, undefined, undefined);
  const top = data.rows.slice(0, 3).map((row) => ({
    place: row.place,
    name: row.nickname ?? "—",
    value: points(row.points, locale),
  }));
  return renderCard({
    brand: t.site.name,
    title: t.rating.title,
    rows: top.length > 0 ? top : undefined,
    footer: data.season
      ? `${data.tournament?.name ?? ""} · ${t.og.season.replace("{season}", data.season.name)}`
      : t.og.tagline,
  });
}
