import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { RATING_TAG } from "./rating.cached";
import { getStandingsPage } from "./standings";

/**
 * Shared by everyone. It is not refreshed on a timer: it is cleared with the rating whenever a
 * result is entered, by an admin or by the results timer (`invalidateRating`, D-127). The long
 * `revalidate` is only a safety net in case a clearing is ever missed.
 */
export async function getStandingsPageCached(
  tournament: string | undefined,
  season: string | undefined,
) {
  "use cache";
  cacheTag(RATING_TAG);
  cacheLife({ stale: 300, revalidate: 21_600, expire: 86_400 });
  return getStandingsPage(createAnonClient(), { tournament, season });
}
