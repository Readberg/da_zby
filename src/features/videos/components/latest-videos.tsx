import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { siteConfig } from "@/config/site";
import { VideosUnavailableError, type Video } from "@/server/services/videos";
import { VideoShowcase } from "./video-showcase";
import { getMessages } from "@/i18n/server";

/** The newest one is the main video, the next three are listed beside it. */
export const HOME_VIDEOS_COUNT = 4;

const channelUrl = siteConfig.social.find((link) => link.id === "youtube")?.url ?? "";

export function VideosUnavailable() {
  const t = getMessages();
  return (
    <Card variant="accent" title={t.home.unavailableTitle}>
      <p className="mb-4">{t.home.unavailableText}</p>
      <a
        href={channelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses("primary")}
      >
        {t.home.toChannel}
        <span className="sr-only"> {t.common.opensInNewTab}</span>
      </a>
    </Card>
  );
}

export function LatestVideosSkeleton() {
  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[2fr_1fr]">
      <Skeleton className="aspect-video w-full" />
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-1">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="aspect-video w-full lg:aspect-auto lg:h-28" />
        ))}
      </div>
    </div>
  );
}

/** Server component: reads videos straight from the service (no HTTP hop). */
export async function LatestVideos({
  loadVideos,
}: {
  loadVideos: (limit: number) => Promise<Video[]>;
}) {
  let videos: Video[];
  try {
    videos = await loadVideos(HOME_VIDEOS_COUNT);
  } catch (error) {
    if (error instanceof VideosUnavailableError) return <VideosUnavailable />;
    throw error;
  }
  if (videos.length === 0) return <VideosUnavailable />;
  return <VideoShowcase videos={videos} />;
}
