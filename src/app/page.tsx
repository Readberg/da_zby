import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { LatestVideos, LatestVideosSkeleton } from "@/features/videos/components/latest-videos";
import { ru } from "@/messages/ru";
import { videosService } from "@/server/services/videos.server";

export default function Home() {
  return (
    <Container className="flex flex-col gap-6 py-6 sm:py-10">
      <h1 className="text-h3 sm:text-h1">{ru.home.videosTitle}</h1>
      <Suspense fallback={<LatestVideosSkeleton />}>
        <LatestVideos loadVideos={videosService.getLatestVideos} />
      </Suspense>
    </Container>
  );
}
