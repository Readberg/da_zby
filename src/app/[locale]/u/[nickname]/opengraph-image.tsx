import { renderCard } from "@/lib/og-card";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-theme";
import { points } from "@/lib/plural";
import { createAnonClient } from "@/lib/supabase/anon";
import { dictionaries } from "@/i18n/dictionaries";
import { initLocale } from "@/i18n/server";
import { getPublicProfile } from "@/server/services/public-profiles";
import { getProfileStatsCached } from "@/server/services/rating.cached";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Link preview of a participant: nickname, place and points of the newest season (D-091). */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; nickname: string }>;
}) {
  const locale = await initLocale(params);
  // Route handlers have no per-request store, so the dictionary is taken by the language directly.
  const t = dictionaries[locale];
  const { nickname } = await params;
  const profile = await getPublicProfile(createAnonClient(), decodeURIComponent(nickname));
  const brand = t.site.name;

  if (!profile) {
    return renderCard({ brand, title: t.og.notFound, footer: t.og.tagline, status: 404 });
  }

  const [latest] = await getProfileStatsCached(profile.id);
  const place = latest?.place ? t.og.place.replace("{place}", String(latest.place)) : null;
  return renderCard({
    brand,
    title: profile.nickname,
    subtitle: latest && place ? `${place} · ${points(latest.points, locale)}` : t.og.noStats,
    footer: latest
      ? `${latest.tournamentName} · ${t.og.season.replace("{season}", latest.seasonName)}`
      : t.og.tagline,
  });
}
