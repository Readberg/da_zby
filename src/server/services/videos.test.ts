// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { VIDEOS_TTL_MS, VideosUnavailableError, createVideosService, feedUrls } from "./videos";
import { parseYouTubeFeed } from "./youtube-feed";

const CHANNEL = "UCsfcA6cY0bSL781TE3XMEPA";
const uploadsXml = readFileSync("tests/fixtures/youtube-uploads.xml", "utf8");
const channelXml = readFileSync("tests/fixtures/youtube-channel.xml", "utf8");

function xmlResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "application/xml" } });
}

describe("parseYouTubeFeed", () => {
  it("reads id, title, date and detects Shorts", () => {
    const videos = parseYouTubeFeed(channelXml);
    expect(videos).toHaveLength(15);
    expect(videos.filter((v) => v.isShort).length).toBeGreaterThan(0);
    for (const video of videos) {
      expect(video.id).toMatch(/^[\w-]{11}$/);
      expect(video.title.length).toBeGreaterThan(0);
      expect(video.publishedAt).toMatch(/Z$/);
    }
  });

  it("decodes XML entities in titles", () => {
    const xml = `<feed><entry><yt:videoId>abcdefghijk</yt:videoId><title>A &amp; B &#171;x&#187; &quot;q&quot;</title><link rel="alternate" href="https://www.youtube.com/watch?v=abcdefghijk"/><published>2026-01-01T10:00:00+03:00</published></entry></feed>`;
    expect(parseYouTubeFeed(xml)).toEqual([
      {
        id: "abcdefghijk",
        title: 'A & B «x» "q"',
        publishedAt: "2026-01-01T07:00:00.000Z",
        isShort: false,
      },
    ]);
  });

  it("skips malformed entries", () => {
    const xml = `<feed><entry><title>no id</title></entry></feed>`;
    expect(parseYouTubeFeed(xml)).toEqual([]);
  });
});

describe("feedUrls", () => {
  it("prefers the long-form uploads playlist, then the channel feed", () => {
    expect(feedUrls(CHANNEL)).toEqual([
      "https://www.youtube.com/feeds/videos.xml?playlist_id=UULFsfcA6cY0bSL781TE3XMEPA",
      "https://www.youtube.com/feeds/videos.xml?channel_id=UCsfcA6cY0bSL781TE3XMEPA",
    ]);
  });
});

describe("videos service", () => {
  it("returns regular videos newest first with the public DTO fields", async () => {
    const fetcher = vi.fn(async () => xmlResponse(uploadsXml));
    const service = createVideosService({ channelId: CHANNEL, fetcher });

    const videos = await service.getLatestVideos(6);

    expect(videos).toHaveLength(6);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(videos[0]).toEqual({
      id: expect.any(String),
      title: expect.any(String),
      publishedAt: expect.any(String),
      thumbnailUrl: `https://i.ytimg.com/vi/${videos[0]!.id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${videos[0]!.id}`,
    });
    const dates = videos.map((v) => v.publishedAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("falls back to the channel feed without Shorts when the playlist fails", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes("playlist_id") ? xmlResponse("", 404) : xmlResponse(channelXml),
    );
    const service = createVideosService({ channelId: CHANNEL, fetcher });

    const videos = await service.getLatestVideos(20);
    const shortIds = parseYouTubeFeed(channelXml)
      .filter((v) => v.isShort)
      .map((v) => v.id);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(videos.length).toBeGreaterThan(0);
    expect(videos.some((v) => shortIds.includes(v.id))).toBe(false);
  });

  it("caches for an hour", async () => {
    let time = 0;
    const fetcher = vi.fn(async () => xmlResponse(uploadsXml));
    const service = createVideosService({ channelId: CHANNEL, fetcher, now: () => time });

    await service.getLatestVideos(6);
    time += VIDEOS_TTL_MS - 1;
    await service.getLatestVideos(6);
    expect(fetcher).toHaveBeenCalledTimes(1);

    time += 2;
    await service.getLatestVideos(6);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("serves the stale list when YouTube is down", async () => {
    let time = 0;
    let down = false;
    const fetcher = vi.fn(async () => {
      if (down) throw new TypeError("fetch failed");
      return xmlResponse(uploadsXml);
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const service = createVideosService({ channelId: CHANNEL, fetcher, now: () => time });

    const fresh = await service.getLatestVideos(6);
    down = true;
    time += VIDEOS_TTL_MS + 1;

    await expect(service.getLatestVideos(6)).resolves.toEqual(fresh);
  });

  it("throws VideosUnavailableError when YouTube is down and nothing is cached", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const service = createVideosService({ channelId: CHANNEL, fetcher });
    await expect(service.getLatestVideos(6)).rejects.toBeInstanceOf(VideosUnavailableError);
  });

  it("shares one request between concurrent callers", async () => {
    const fetcher = vi.fn(async () => xmlResponse(uploadsXml));
    const service = createVideosService({ channelId: CHANNEL, fetcher });
    await Promise.all([service.getLatestVideos(1), service.getLatestVideos(6)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
