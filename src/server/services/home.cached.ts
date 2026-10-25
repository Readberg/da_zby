import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { getPredictionsPublic } from "./predictions";
import { getRatingPage } from "./rating";
import { RATING_TAG } from "./rating.cached";

/**
 * Public data of the landing page: the current tournament with its tours and matches, and the
 * leaders of the current season. Cached like the rating (30 minutes, cleared by admin changes);
 * the clock-dependent parts (which tour is next, is it still open) are worked out per request.
 */
export async function getHomeCached() {
  "use cache";
  cacheLife({ stale: 300, revalidate: 1800, expire: 86_400 });
  cacheTag(RATING_TAG);
  const db = createAnonClient();
  const [pub, rating] = await Promise.all([getPredictionsPublic(db, {}), getRatingPage(db, {})]);
  return { pub, leaders: rating.rows.slice(0, 5) };
}
