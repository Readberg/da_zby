import { endpoints } from "@/server/api/v1/endpoints";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import { withApi } from "@/server/api/v1/with-api";
import { VideosUnavailableError } from "@/server/services/videos";
import { videosService } from "@/server/services/videos.server";

export const GET = withApi(endpoints.videos, async ({ query }) => {
  try {
    const videos = await videosService.getLatestVideos(query.limit);
    // The feed holds at most 15 entries, so there is never a next page.
    return { data: videos, meta: { limit: query.limit, nextCursor: null } };
  } catch (error) {
    if (error instanceof VideosUnavailableError) {
      throw new ApiError(
        503,
        ERROR_CODES.videosUnavailable,
        "Service Unavailable",
        "YouTube is not responding and there is no cached list yet. Try again later.",
      );
    }
    throw error;
  }
});
