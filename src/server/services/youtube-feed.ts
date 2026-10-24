/** Minimal parser for YouTube Atom feeds (`/feeds/videos.xml`); the format is small and stable. */

export type FeedVideo = {
  id: string;
  title: string;
  /** ISO 8601, UTC. */
  publishedAt: string;
  isShort: boolean;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXml(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function tag(entry: string, name: string): string | undefined {
  const match = entry.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return match?.[1] !== undefined ? decodeXml(match[1].trim()) : undefined;
}

/** Returns feed entries in feed order; malformed entries are skipped. */
export function parseYouTubeFeed(xml: string): FeedVideo[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const videos: FeedVideo[] = [];

  for (const entry of entries) {
    const id = tag(entry, "yt:videoId");
    const title = tag(entry, "title");
    const published = tag(entry, "published");
    const link = entry.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? "";
    const publishedAt = published ? new Date(published) : undefined;

    if (!id || !/^[\w-]{11}$/.test(id) || !title || !publishedAt || isNaN(publishedAt.getTime())) {
      continue;
    }

    videos.push({
      id,
      title,
      publishedAt: publishedAt.toISOString(),
      isShort: link.includes("/shorts/"),
    });
  }

  return videos;
}
