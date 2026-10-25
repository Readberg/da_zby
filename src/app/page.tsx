import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Hero } from "@/features/home/components/hero";
import { HowItWorks } from "@/features/home/components/how-it-works";
import { Leaders } from "@/features/home/components/leaders";
import { LatestVideos, LatestVideosSkeleton } from "@/features/videos/components/latest-videos";
import { ru } from "@/messages/ru";
import { videosService } from "@/server/services/videos.server";

async function loadVideos(limit: number) {
  // Videos are request-time data (the service checks its cache age with the clock):
  // tell Cache Components so the static shell is not prerendered with them.
  await connection();
  return videosService.getLatestVideos(limit);
}

/**
 * Landing: what the site is, the next tour with one main action, how it works, who leads, and only
 * then the channel's videos.
 */
export default function Home() {
  return (
    <Container className="flex flex-col gap-16 py-8 sm:gap-20 sm:py-14">
      <Hero />
      <HowItWorks />
      <Leaders />
      <section aria-labelledby="videos-title" className="flex flex-col gap-6">
        <h2 id="videos-title" className="text-h3 sm:text-h2">
          {ru.home.videosTitle}
        </h2>
        <Suspense fallback={<LatestVideosSkeleton />}>
          <LatestVideos loadVideos={loadVideos} />
        </Suspense>
      </section>
    </Container>
  );
}
