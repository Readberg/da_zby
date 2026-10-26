import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingPicker } from "@/features/rating/components/rating-picker";
import { SeasonRatingTable, TourRatingTable } from "@/features/rating/components/rating-table";
import { points } from "@/lib/plural";
import { firstParam } from "@/lib/search-params";
import { ru } from "@/messages/ru";
import { getCurrentUser } from "@/server/services/current-user";
import { getRatingPageCached } from "@/server/services/rating.cached";

export const metadata: Metadata = { title: ru.rating.title };

async function RatingContent({
  searchParams,
}: {
  searchParams: PageProps<"/rating">["searchParams"];
}) {
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

  if (!data.tournament) return <p className="text-muted">{ru.rating.noTournaments}</p>;

  const { season, tour } = data;
  const toPredictions = new URLSearchParams({ tournament: data.tournament.slug });
  if (season) toPredictions.set("season", season.id);
  if (tour) toPredictions.set("tour", String(tour.number));

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
        <p className="text-muted">{ru.rating.noSeasons}</p>
      ) : (
        <section className="flex flex-col gap-4">
          {season.status === "closed" && !tour && (
            <p className="text-sm text-muted">{ru.rating.seasonClosed}</p>
          )}
          {mine && (
            <p className="rounded-lg bg-accent/25 px-5 py-4 font-semibold">
              {ru.rating.yourPlace
                .replace("{place}", String(mine.place ?? "—"))
                .replace("{points}", points(mine.points))}
            </p>
          )}
          {tour ? (
            <TourRatingTable
              rows={data.rows}
              matches={data.matches}
              cells={data.cells}
              currentUserId={user?.id}
            />
          ) : (
            <SeasonRatingTable rows={data.rows} currentUserId={user?.id} />
          )}
          <p className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted">
            <Link href={`/predictions?${toPredictions}`} className="underline">
              {ru.rating.toPredictions}
            </Link>
            <span>{ru.rating.cacheNote}</span>
          </p>
        </section>
      )}
    </>
  );
}

export default function RatingPage(props: PageProps<"/rating">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <h1 className="text-h3 sm:text-h1">{ru.rating.title}</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <RatingContent searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
