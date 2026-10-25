import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { getProfileStats, getRatingPage } from "./rating";

/** Tag that admin actions invalidate (results, season state, tournaments): see `invalidateRating`. */
export const RATING_TAG = "rating";

// Shared data is cached for 30 minutes (PRODUCT §7); a result entered by an admin clears it at once.
const LIFE = { stale: 300, revalidate: 1800, expire: 86_400 } as const;

export async function getRatingPageCached(
  tournament: string | undefined,
  season: string | undefined,
  tour: number | undefined,
) {
  "use cache";
  cacheLife(LIFE);
  cacheTag(RATING_TAG);
  return getRatingPage(createAnonClient(), { tournament, season, tour });
}

export async function getProfileStatsCached(userId: string) {
  "use cache";
  cacheLife(LIFE);
  cacheTag(RATING_TAG);
  return getProfileStats(createAnonClient(), userId);
}
