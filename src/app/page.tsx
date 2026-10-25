import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { GuestLanding } from "@/features/home/components/guest-landing";
import { Hero } from "@/features/home/components/hero";
import { HowItWorks } from "@/features/home/components/how-it-works";
import { Leaders } from "@/features/home/components/leaders";
import { LatestVideos, LatestVideosSkeleton } from "@/features/videos/components/latest-videos";
import { ru } from "@/messages/ru";
import { getCurrentUser } from "@/server/services/current-user";
import { videosService } from "@/server/services/videos.server";

async function loadVideos(limit: number) {
  // Videos are request-time data (the service checks its cache age with the clock):
  // tell Cache Components so the static shell is not prerendered with them.
  await connection();
  return videosService.getLatestVideos(limit);
}

function Videos() {
  return (
    <section aria-labelledby="videos-title" className="flex flex-col gap-6">
      <h2 id="videos-title" className="text-h3 sm:text-h2">
        {ru.home.videosTitle}
      </h2>
      <Suspense fallback={<LatestVideosSkeleton />}>
        <LatestVideos loadVideos={loadVideos} />
      </Suspense>
    </section>
  );
}

/** Signed-in visitors: the next tour with one main action, how it works, leaders and videos. */
function MemberHome() {
  return (
    <Container className="flex flex-col gap-16 py-8 sm:gap-20 sm:py-14">
      <Hero />
      <HowItWorks />
      <Leaders />
      <Videos />
    </Container>
  );
}

async function HomeBody() {
  const user = await getCurrentUser();
  return user ? <MemberHome /> : <GuestLanding videos={<Videos />} />;
}

/**
 * Guests get the landing (it is also the static shell, so search engines and link previews see it);
 * signed-in visitors get the member home once the session is known.
 */
export default function Home() {
  return (
    <Suspense fallback={<GuestLanding videos={<Videos />} />}>
      <HomeBody />
    </Suspense>
  );
}
