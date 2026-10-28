import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { PredictionPicker } from "@/features/predictions/components/prediction-picker";
import { PredictionTable } from "@/features/predictions/components/prediction-table";
import { formatDateTime } from "@/lib/local-time";
import { points } from "@/lib/plural";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_UTC_OFFSET_MINUTES } from "@/lib/time";
import { firstParam } from "@/lib/search-params";
import { getCurrentUser } from "@/server/services/current-user";
import { composePredictionsPage, getMyPredictions } from "@/server/services/predictions";
import { getPredictionsPublicCached } from "@/server/services/predictions.cached";
import { getUtcOffsetMinutes } from "@/server/services/profiles";
import { getMessages, initLocale, messagesFor, getLocale } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/predictions">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.predictions.title };
}

async function PredictionsContent({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/predictions">["searchParams"];
}) {
  const locale = getLocale();
  const t = getMessages();
  // Deadlines depend on the current time: render at request time, never in the static shell.
  await connection();
  const params = await searchParams;
  const tourNumber = Number(firstParam(params.tour));
  const supabase = await createClient();
  // The shared part comes from the cache (in parallel with finding the visitor); the visitor's own
  // predictions are read live.
  const [user, pub] = await Promise.all([
    getCurrentUser(),
    getPredictionsPublicCached(firstParam(params.tournament), firstParam(params.season)),
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

  if (!data.tournament) return <p className="text-muted">{t.predictions.noTournaments}</p>;

  const { tour, season } = data;
  const query = new URLSearchParams();
  query.set("tournament", data.tournament.slug);
  if (season) query.set("season", season.id);
  if (tour) query.set("tour", String(tour.number));

  return (
    <>
      <PredictionPicker
        data={{
          tournaments: data.tournaments,
          tournament: data.tournament,
          seasons: data.seasons,
          season: data.season,
          tours: data.tours,
          tour: data.tour,
        }}
      />

      {!season || !tour ? (
        <p className="text-muted">{season ? t.predictions.noTours : t.predictions.noSeasons}</p>
      ) : (
        <section aria-labelledby="tour-title" className="flex flex-col gap-4">
          <div>
            <h2 id="tour-title" className="text-lg normal-case sm:text-h3 sm:uppercase">
              {t.predictions.tourN.replace("{n}", String(tour.number))}
              {tour.title ? ` · ${tour.title}` : ""}
            </h2>
            <p
              className={`mt-2 inline-flex rounded-sm border px-3 py-1 text-sm font-semibold ${
                tour.open && season.status !== "closed"
                  ? "border-accent/50 text-accent"
                  : "border-line text-muted"
              }`}
            >
              {season.status === "closed"
                ? t.predictions.seasonIsClosed
                : tour.deadlineAt
                  ? tour.open
                    ? `${t.predictions.openUntil} ${formatDateTime(tour.deadlineAt, offset, locale)}`
                    : `${t.predictions.closedSince} ${formatDateTime(tour.deadlineAt, offset, locale)}`
                  : t.predictions.noDeadline}
            </p>
          </div>
          <p className="text-sm">
            <Link
              href={`/rating?${query}`}
              className="inline-flex min-h-10 items-center rounded-sm border border-line px-4 font-semibold transition-colors duration-200 hover:bg-surface-hover"
            >
              {t.predictions.toRating}
            </Link>
          </p>
          {data.tournament && (
            <details className="group rounded-lg border border-line bg-surface px-5 py-4">
              <summary className="cursor-pointer font-semibold">{t.predictions.rulesTitle}</summary>
              <p className="mt-2 text-muted">
                {t.predictions.rules
                  .replace("{exact}", points(data.tournament.pointsExact, locale))
                  .replace("{outcome}", points(data.tournament.pointsOutcome, locale))}
              </p>
            </details>
          )}
          <PredictionTable
            key={tour.id}
            tourId={tour.id}
            matches={data.matches}
            signedIn={Boolean(user)}
            offsetMinutes={offset}
            open={tour.open}
            ratingHref={`/rating?${query}`}
            loginHref={`/login?next=${encodeURIComponent(`/predictions?${query}`)}`}
          />
        </section>
      )}
    </>
  );
}

export default async function PredictionsPage(props: PageProps<"/[locale]/predictions">) {
  await initLocale(props.params);
  const t = getMessages();
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12 lg:py-20">
      <h1 className="text-h3 sm:text-h1">{t.predictions.title}</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <PredictionsContent searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
