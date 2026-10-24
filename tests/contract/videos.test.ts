// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listMetaSchema, videoListSchema } from "@/server/api/v1/schemas/videos";
import { VideosUnavailableError } from "@/server/services/videos";
import { apiRequest, expectApiHeaders, expectProblem, fakeSupabase } from "./helpers";

const createClient = vi.fn();
const getLatestVideos = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/server/services/videos.server", () => ({ videosService: { getLatestVideos } }));

const route = await import("@/app/api/v1/videos/route");

const sample = Array.from({ length: 6 }, (_, i) => ({
  id: `vid${String(i).padStart(8, "0")}`,
  title: `Видео ${i}`,
  publishedAt: `2026-10-${String(20 - i).padStart(2, "0")}T12:00:00.000Z`,
  thumbnailUrl: `https://i.ytimg.com/vi/vid${i}/hqdefault.jpg`,
  url: `https://www.youtube.com/watch?v=vid${i}`,
}));

describe("GET /api/v1/videos", () => {
  beforeEach(() => {
    createClient.mockResolvedValue(fakeSupabase());
    getLatestVideos.mockReset();
  });

  it("returns videos and list meta", async () => {
    getLatestVideos.mockResolvedValue(sample);
    const response = await route.GET(apiRequest("/api/v1/videos?limit=6"));

    expect(response.status).toBe(200);
    expectApiHeaders(response);
    const body = await response.json();
    expect(videoListSchema.parse(body.data)).toHaveLength(6);
    expect(listMetaSchema.parse(body.meta)).toEqual({ limit: 6, nextCursor: null });
    expect(getLatestVideos).toHaveBeenCalledWith(6);
  });

  it("defaults the limit to 20", async () => {
    getLatestVideos.mockResolvedValue(sample);
    await route.GET(apiRequest("/api/v1/videos"));
    expect(getLatestVideos).toHaveBeenCalledWith(20);
  });

  it.each(["0", "101", "abc", "2.5"])("rejects limit=%s with 422", async (limit) => {
    const body = await expectProblem(
      await route.GET(apiRequest(`/api/v1/videos?limit=${limit}`)),
      422,
      "api.validation_failed",
    );
    expect(body.errors?.[0]?.field).toBe("limit");
    expect(getLatestVideos).not.toHaveBeenCalled();
  });

  it("answers 503 videos.unavailable when there is no data at all", async () => {
    getLatestVideos.mockRejectedValue(new VideosUnavailableError());
    await expectProblem(await route.GET(apiRequest("/api/v1/videos")), 503, "videos.unavailable");
  });
});
