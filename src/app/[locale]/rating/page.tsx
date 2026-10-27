import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingPicker } from "@/features/rating/components/rating-picker";
import { SeasonRatingTable, TourRatingTable } from "@/features/rating/components/rating-table";
import { windowRows } from "@/features/rating/window";
import { formatDateTime } from "@/lib/local-time";
import { hiddenUntil } from "@/lib/predictions";
import { points } from "@/lib/plural";
import { firstParam } from "@/lib/search-params";
import { getCurrentUser } from "@/server/services/current-user";
import { getRatingPageCached } from "@/server/services/rating.cached";
import { getMessages, initLocale, messagesFor, getLocale } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/rating">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.rating.title };
}

async function RatingContent({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/rating">["searchParams"];
}) {
  const locale = getLocale();
  const t = getMessages();
  // The page compares the deadline with the clock: request time, not part of the prerendered shell.
  await connection();
  const params = await searchParams;
  const tourNumber = Number(firstParam(params.tour));
  // The shared table comes from the cache; who is looking is worked out per request, in parallel.
  const [data, user] = await Promise.all([
    getRatingPageCached(
      firstParam(params.tournament),
      firstParam(params.season),
      Number.isInteger(tourNumber) && tourNumber > 0 ? tourNumber : undefined,
    ),
    getCurrentUser(),
  ]);
  const mine = user ? data.rows.find((row) => row.userId === user.id) : undefined;
  const expanded = firstParam(params.around) === "1";
  const view = windowRows(data.rows, user?.id, expanded);

  if (!data.tournament) return <p className="text-muted">{t.rating.noTournaments}</p>;

  const { season, tour } = data;
  // Until the tour's deadline the others' predictions are hidden by the database (D-084).
  const hidden = hiddenUntil(tour?.deadlineAt ?? null);
  const toPredictions = new URLSearchParams({ tournament: data.tournament.slug });
  if (season) toPredictions.set("season", season.id);
  if (tour) toPredictions.set("tour", String(tour.number));
  // The same page with the neighbours of the viewer shown or hidden.
  const neighbours = new URLSearchParams(toPredictions);
  if (!expanded) neighbours.set("around", "1");

  return (
    <>
      <RatingPicker
        data={{
          tournaments: data.tournaments,
          tournament: data.tournament,
          seasons: data.seasons,
          season: data.season,
          tours: data.tours,
          tour: data.tour,
        }}
      />
      {!season ? (
        <p className="text-muted">{t.rating.noSeasons}</p>
      ) : (
        <section className="flex flex-col gap-4">
          {season.status === "closed" && !tour && (
            <p className="text-sm text-muted">{t.rating.seasonClosed}</p>
          )}
          {mine && (
            <p className="rounded-lg bg-accent/25 px-5 py-4 font-semibold">
              {t.rating.yourPlace
                .replace("{place}", String(mine.place ?? "—"))
                .replace("{points}", points(mine.points, locale))}
            </p>
          )}
          {hidden && (
            <p role="status" className="rounded-lg border border-line px-5 py-4 text-muted">
              {t.rating.predictionsHidden.replace(
                "{date}",
                formatDateTime(hidden, undefined, locale),
              )}
            </p>
          )}
          {tour && hidden && data.rows.length === 0 ? null : tour ? (
            <TourRatingTable
              rows={view.rows}
              matches={data.matches}
              cells={data.cells}
              currentUserId={user?.id}
              gapBefore={view.gapBefore}
              gapAfter={view.gapAfter}
            />
          ) : (
            <SeasonRatingTable
              rows={view.rows}
              currentUserId={user?.id}
              gapBefore={view.gapBefore}
              gapAfter={view.gapAfter}
            />
          )}
          {(view.canExpand || expanded) && mine && (
            <Link
              href={`/rating?${neighbours}`}
              scroll={false}
              className="w-fit text-sm font-semibold underline"
            >
              {expanded ? t.rating.hideNeighbours : t.rating.showNeighbours}
            </Link>
          )}
          <p className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted">
            <Link href={`/predictions?${toPredictions}`} className="underline">
              {t.rating.toPredictions}
            </Link>
            <span>{t.rating.cacheNote}</span>
          </p>
        </section>
      )}
    </>
  );
}

export default async function RatingPage(props: PageProps<"/[locale]/rating">) {
  await initLocale(props.params);
  const t = getMessages();
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <h1 className="text-h3 sm:text-h1">{t.rating.title}</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <RatingContent searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
