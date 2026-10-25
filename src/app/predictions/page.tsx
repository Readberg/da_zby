import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { PredictionPicker } from "@/features/predictions/components/prediction-picker";
import { PredictionTable } from "@/features/predictions/components/prediction-table";
import { formatDateTime } from "@/lib/local-time";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_UTC_OFFSET_MINUTES } from "@/lib/time";
import { ru } from "@/messages/ru";
import { getCurrentUser } from "@/server/services/current-user";
import { composePredictionsPage, getMyPredictions } from "@/server/services/predictions";
import { getPredictionsPublicCached } from "@/server/services/predictions.cached";
import { getUtcOffsetMinutes } from "@/server/services/profiles";

export const metadata: Metadata = { title: ru.predictions.title };

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function PredictionsContent({
  searchParams,
}: {
  searchParams: PageProps<"/predictions">["searchParams"];
}) {
  // Deadlines depend on the current time: render at request time, never in the static shell.
  await connection();
  const params = await searchParams;
  const tourNumber = Number(first(params.tour));
  const supabase = await createClient();
  // The shared part comes from the cache (in parallel with finding the visitor); the visitor's own
  // predictions are read live.
  const [user, pub] = await Promise.all([
    getCurrentUser(),
    getPredictionsPublicCached(first(params.tournament), first(params.season)),
  ]);
  const [mine, offset] = await Promise.all([
    user && pub.season ? getMyPredictions(supabase, user.id, pub.season.id) : Promise.resolve({}),
    user ? getUtcOffsetMinutes(supabase, user.id) : Promise.resolve(DEFAULT_UTC_OFFSET_MINUTES),
  ]);
  const data = composePredictionsPage(
    pub,
    mine,
    Number.isInteger(tourNumber) && tourNumber > 0 ? tourNumber : undefined,
  );

  if (!data.tournament) return <p className="text-muted">{ru.predictions.noTournaments}</p>;

  const { tour, season } = data;
  const query = new URLSearchParams();
  query.set("tournament", data.tournament.slug);
  if (season) query.set("season", season.id);
  if (tour) query.set("tour", String(tour.number));

  return (
    <>
      <PredictionPicker data={data} />

      {!season || !tour ? (
        <p className="text-muted">{season ? ru.predictions.noTours : ru.predictions.noSeasons}</p>
      ) : (
        <section aria-labelledby="tour-title" className="flex flex-col gap-4">
          <div>
            <h2 id="tour-title" className="text-lg normal-case sm:text-h3 sm:uppercase">
              {ru.admin.tours.tourN.replace("{n}", String(tour.number))}
              {tour.title ? ` · ${tour.title}` : ""}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {season.status === "closed"
                ? ru.predictions.seasonIsClosed
                : tour.deadlineAt
                  ? tour.open
                    ? `${ru.predictions.openUntil} ${formatDateTime(tour.deadlineAt, offset)}`
                    : `${ru.predictions.closedSince} ${formatDateTime(tour.deadlineAt, offset)}`
                  : ru.predictions.noDeadline}
            </p>
          </div>
          <p className="text-sm">
            <Link href={`/rating?${query}`} className="underline">
              {ru.predictions.toRating}
            </Link>
          </p>
          <PredictionTable
            key={tour.id}
            tourId={tour.id}
            matches={data.matches}
            signedIn={Boolean(user)}
            offsetMinutes={offset}
            open={tour.open}
            loginHref={`/login?next=${encodeURIComponent(`/predictions?${query}`)}`}
          />
        </section>
      )}
    </>
  );
}

export default function PredictionsPage(props: PageProps<"/predictions">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <h1 className="text-h3 sm:text-h1">{ru.predictions.title}</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <PredictionsContent searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
