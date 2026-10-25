import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingPicker } from "@/features/rating/components/rating-picker";
import { SeasonRatingTable, TourRatingTable } from "@/features/rating/components/rating-table";
import { ru } from "@/messages/ru";
import { getRatingPageCached } from "@/server/services/rating.cached";

export const metadata: Metadata = { title: ru.rating.title };

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function RatingContent({
  searchParams,
}: {
  searchParams: PageProps<"/rating">["searchParams"];
}) {
  const params = await searchParams;
  const tourNumber = Number(first(params.tour));
  const data = await getRatingPageCached(
    first(params.tournament),
    first(params.season),
    Number.isInteger(tourNumber) && tourNumber > 0 ? tourNumber : undefined,
  );

  if (!data.tournament) return <p className="text-muted">{ru.rating.noTournaments}</p>;

  const { season, tour } = data;
  const toPredictions = new URLSearchParams({ tournament: data.tournament.slug });
  if (season) toPredictions.set("season", season.id);
  if (tour) toPredictions.set("tour", String(tour.number));

  return (
    <>
      <RatingPicker data={data} />
      {!season ? (
        <p className="text-muted">{ru.rating.noSeasons}</p>
      ) : (
        <section className="flex flex-col gap-4">
          {season.status === "closed" && !tour && (
            <p className="text-sm text-muted">{ru.rating.seasonClosed}</p>
          )}
          {tour ? (
            <TourRatingTable rows={data.rows} matches={data.matches} cells={data.cells} />
          ) : (
            <SeasonRatingTable rows={data.rows} />
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
