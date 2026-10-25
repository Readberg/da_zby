import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { getPredictionsPublic } from "./predictions";
import { RATING_TAG } from "./rating.cached";

/**
 * Public data of the predictions page, cached like the rating (30 minutes, cleared at once by
 * admin changes). The visitor's own predictions and the deadline checks stay live.
 */
export async function getPredictionsPublicCached(
  tournament: string | undefined,
  season: string | undefined,
) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 1800, expire: 86_400 });
  cacheTag(RATING_TAG);
  return getPredictionsPublic(createAnonClient(), { tournament, season });
}
