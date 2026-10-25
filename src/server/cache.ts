import "server-only";
import { revalidateTag } from "next/cache";
import { RATING_TAG } from "@/server/services/rating.cached";

/** Drops the cached rating and statistics so the next visitor sees fresh numbers. */
export function invalidateRating(): void {
  revalidateTag(RATING_TAG, { expire: 0 });
}
