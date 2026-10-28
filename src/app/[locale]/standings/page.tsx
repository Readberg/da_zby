import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { StandingsPicker } from "@/features/standings/components/standings-picker";
import { StandingsTable } from "@/features/standings/components/standings-table";
import { firstParam } from "@/lib/search-params";
import { getStandingsPageCached } from "@/server/services/standings.cached";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/standings">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.standings.title };
}

async function StandingsContent({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/standings">["searchParams"];
}) {
  const t = getMessages();
  const params = await searchParams;
  const data = await getStandingsPageCached(
    firstParam(params.tournament),
    firstParam(params.season),
  );
  if (!data.tournament) return <p className="text-muted">{t.standings.noTournaments}</p>;

  return (
    <>
      <StandingsPicker
        data={{
          tournaments: data.tournaments,
          tournament: data.tournament,
          seasons: data.seasons,
          season: data.season,
        }}
      />
      {!data.season ? (
        <p className="text-muted">{t.rating.noSeasons}</p>
      ) : data.rows.length === 0 ? (
        <p className="text-muted">{t.standings.empty}</p>
      ) : (
        <section className="flex flex-col gap-4">
          <StandingsTable rows={data.rows} />
          <p className="text-sm text-muted">
            {t.standings.counted
              .replace("{counted}", String(data.counted))
              .replace("{total}", String(data.total))}
          </p>
          <p className="text-sm text-muted">{t.standings.rules}</p>
        </section>
      )}
    </>
  );
}

export default async function StandingsPage(props: PageProps<"/[locale]/standings">) {
  await initLocale(props.params);
  const t = getMessages();
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12 lg:py-20">
      <h1 className="text-h3 sm:text-h1">{t.standings.title}</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <StandingsContent searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
