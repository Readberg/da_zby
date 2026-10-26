import { errorFields, log } from "@/lib/log";
import { parseYouTubeFeed, type FeedVideo } from "./youtube-feed";

export type Video = {
  id: string;
  title: string;
  /** ISO 8601, UTC. */
  publishedAt: string;
  thumbnailUrl: string;
  url: string;
};

export class VideosUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("YouTube feed is unavailable and nothing is cached yet", { cause });
    this.name = "VideosUnavailableError";
  }
}

const FEED_BASE = "https://www.youtube.com/feeds/videos.xml";
export const VIDEOS_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

/**
 * Feed URLs in priority order. `UULF…` is the channel's long-form uploads playlist (no Shorts);
 * it is undocumented, so the regular channel feed (Shorts filtered out) is the fallback (D-045).
 */
export function feedUrls(channelId: string): string[] {
  return [
    `${FEED_BASE}?playlist_id=UULF${channelId.slice(2)}`,
    `${FEED_BASE}?channel_id=${channelId}`,
  ];
}

function toVideo(entry: FeedVideo): Video {
  return {
    id: entry.id,
    title: entry.title,
    publishedAt: entry.publishedAt,
    thumbnailUrl: `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${entry.id}`,
  };
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function fetchVideos(channelId: string, fetcher: Fetcher): Promise<Video[]> {
  let lastError: unknown;
  for (const url of feedUrls(channelId)) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`YouTube feed responded ${response.status}`);
      const videos = parseYouTubeFeed(await response.text())
        .filter((entry) => !entry.isShort)
        .map(toVideo)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      if (videos.length > 0) return videos;
      lastError = new Error("YouTube feed has no regular videos");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

type CacheEntry = { videos: Video[]; fetchedAt: number };

/**
 * Latest regular (non-Shorts) videos of the channel, newest first.
 * Cached in memory for an hour; when YouTube fails, the last good list is served even if stale.
 */
export function createVideosService({
  channelId,
  fetcher = fetch,
  now = Date.now,
}: {
  channelId: string;
  fetcher?: Fetcher;
  now?: () => number;
}) {
  let cache: CacheEntry | undefined;
  let inFlight: Promise<Video[]> | undefined;

  async function refresh(): Promise<Video[]> {
    inFlight ??= fetchVideos(channelId, fetcher)
      .then((videos) => {
        cache = { videos, fetchedAt: now() };
        return videos;
      })
      .finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  }

  return {
    async getLatestVideos(limit: number): Promise<Video[]> {
      if (cache && now() - cache.fetchedAt < VIDEOS_TTL_MS) {
        return cache.videos.slice(0, limit);
      }
      try {
        return (await refresh()).slice(0, limit);
      } catch (error) {
        if (cache) {
          log("warn", "videos.feed_failed", { serving: "cached list", ...errorFields(error) });
          return cache.videos.slice(0, limit);
        }
        throw new VideosUnavailableError(error);
      }
    },
  };
}
