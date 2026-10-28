type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/**
 * Fixed-window counter kept in this server's memory. Enough to stop one client from flooding a
 * public endpoint; it is not shared between instances and restarts with the process.
 * Returns true when the call is allowed.
 */
export function allowRequest(key: string, limit: number, windowMs: number, now = Date.now()) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      // Still full of live windows: drop the oldest instead of growing without bound.
      if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value as string);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/**
 * The client address as the platform proxy saw it. The last `x-forwarded-for` entry is the one our
 * own proxy appended; earlier ones can be written by the client.
 */
export function clientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  return last || headers.get("x-real-ip")?.trim() || "unknown";
}

/** For tests. */
export function resetRateLimits() {
  buckets.clear();
}
