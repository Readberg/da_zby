import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { RATING_TAG } from "./rating.cached";
import { getStandingsPage } from "./standings";

/** Shared by everyone, cleared with the rating whenever an admin enters a result (`invalidateRating`). */
export async function getStandingsPageCached(
  tournament: string | undefined,
  season: string | undefined,
) {
  "use cache";
  cacheTag(RATING_TAG);
  cacheLife({ stale: 300, revalidate: 1800, expire: 86_400 });
  return getStandingsPage(createAnonClient(), { tournament, season });
}
