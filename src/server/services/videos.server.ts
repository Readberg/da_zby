import "server-only";
import { serverEnv } from "@/lib/env.server";
import { createVideosService } from "./videos";

/** App-wide instance: one in-memory cache per server process. */
export const videosService = createVideosService({ channelId: serverEnv.YOUTUBE_CHANNEL_ID });
