import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Loader } from "@/components/ui/loader";
import { Skeleton } from "@/components/ui/skeleton";
import { GuestLanding } from "@/features/home/components/guest-landing";
import { GuestSlot, SessionKnown } from "@/features/home/components/home-fallback";
import { MemberAction, NextTour } from "@/features/home/components/next-tour";
import { Leaders } from "@/features/home/components/leaders";
import { LatestVideos, LatestVideosSkeleton } from "@/features/videos/components/latest-videos";
import { getCurrentUser } from "@/server/services/current-user";
import { siteOpenGraph } from "@/lib/open-graph";
import { videosService } from "@/server/services/videos.server";
import { getMessages, initLocale } from "@/i18n/server";

/** The home page is the one address that is the site itself: it names itself as canonical. */
export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = await initLocale(params);
  return { alternates: { canonical: "/" }, openGraph: siteOpenGraph(locale, getMessages(), "/") };
}

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
    <Container className="flex flex-col gap-12 py-8 sm:gap-16 sm:py-12 lg:gap-24 lg:py-20">
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

/** Reports the session to the landing and, for a signed-in visitor, adds the member home. */
async function MemberSwitch() {
  const user = await getCurrentUser();
  if (!user) return <SessionKnown member={false} />;
  return (
    <>
      <SessionKnown member />
      <MemberHome />
    </>
  );
}

/**
 * Guests get the landing (it is the static shell, sent once, so search engines and link previews
 * see it); signed-in visitors get the member home once the session is known (DAZBY-125).
 */
export default async function Home(props: PageProps<"/[locale]">) {
  await initLocale(props.params);
  return (
    <>
      <GuestSlot
        guest={<GuestLanding videos={<Videos />} />}
        loader={<Loader className="m-8 min-h-96 flex-1" showLabel />}
      />
      <Suspense fallback={null}>
        <MemberSwitch />
      </Suspense>
    </>
  );
}
