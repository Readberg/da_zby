import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Loader } from "@/components/ui/loader";
import { Skeleton } from "@/components/ui/skeleton";
import { GuestLanding } from "@/features/home/components/guest-landing";
import { HomeFallback } from "@/features/home/components/home-fallback";
import { MemberAction, NextTour } from "@/features/home/components/next-tour";
import { Leaders } from "@/features/home/components/leaders";
import { LatestVideos, LatestVideosSkeleton } from "@/features/videos/components/latest-videos";
import { getCurrentUser } from "@/server/services/current-user";
import { videosService } from "@/server/services/videos.server";
import { getMessages, initLocale } from "@/i18n/server";

async function loadVideos(limit: number) {
  // Videos are request-time data (the service checks its cache age with the clock):
  // tell Cache Components so the static shell is not prerendered with them.
  await connection();
  return videosService.getLatestVideos(limit);
}

function Videos() {
  const t = getMessages();
  return (
    <section aria-labelledby="videos-title" className="flex flex-col gap-6">
      <h2 id="videos-title" className="text-h3 sm:text-h2">
        {t.home.videosTitle}
      </h2>
      <Suspense fallback={<LatestVideosSkeleton />}>
        <LatestVideos loadVideos={loadVideos} />
      </Suspense>
    </section>
  );
}

/** Signed-in visitors: the next tour with the main action, the season leaders and the videos. */
function MemberHome() {
  const t = getMessages();
  return (
    <Container className="flex flex-col gap-12 py-8 sm:gap-16 sm:py-12">
      <section aria-labelledby="next-tour-title" className="flex flex-col gap-4">
        <h1 id="next-tour-title" className="text-h3 sm:text-h2">
          {t.home.memberTitle}
        </h1>
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <NextTour />
        </Suspense>
        <div>
          <MemberAction />
        </div>
      </section>
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
export default async function Home(props: PageProps<"/[locale]">) {
  await initLocale(props.params);
  return (
    <Suspense
      fallback={
        <HomeFallback
          guest={<GuestLanding videos={<Videos />} />}
          loader={<Loader className="m-8 min-h-96 flex-1" showLabel />}
        />
      }
    >
      <HomeBody />
    </Suspense>
  );
}
