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
  cacheTag(RATING_TAG);
  const data = await getRatingPage(createAnonClient(), { tournament, season, tour });
  cacheLife(lifeUntil(data.tour?.deadlineAt ?? null));
  return data;
}

/**
 * Other people's predictions open at the tour's deadline (D-084), so the cached tour table must not
 * outlive it: until then the entry expires at the deadline, which makes the first visitor after it
 * wait for a fresh table instead of seeing the hidden one. Floor of 15 s keeps the cache useful.
 */
export function lifeUntil(deadlineAt: string | null, now: number = Date.now()) {
  if (!deadlineAt) return LIFE;
  const seconds = Math.ceil((new Date(deadlineAt).getTime() - now) / 1000);
  if (seconds <= 0 || seconds >= LIFE.revalidate) return LIFE;
  const until = Math.max(15, seconds);
  return { stale: Math.min(LIFE.stale, until), revalidate: until, expire: until } as const;
}

export async function getProfileStatsCached(userId: string) {
  "use cache";
  cacheLife(LIFE);
  cacheTag(RATING_TAG);
  return getProfileStats(createAnonClient(), userId);
}
