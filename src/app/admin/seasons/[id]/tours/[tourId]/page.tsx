import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchForm } from "@/features/admin/components/match-form";
import { TourForm } from "@/features/admin/components/tour-forms";
import { formatDateTime } from "@/lib/local-time";
import { createClient } from "@/lib/supabase/server";
import { ru } from "@/messages/ru";
import { ApiError } from "@/server/api/v1/problem";
import { getTour } from "@/server/services/admin-matches";
import { requireAdmin } from "@/server/services/current-user";
import { getUtcOffsetMinutes } from "@/server/services/profiles";

export const metadata: Metadata = { title: ru.admin.tours.title, robots: { index: false } };

async function TourContent({
  params,
}: {
  params: PageProps<"/admin/seasons/[id]/tours/[tourId]">["params"];
}) {
  const { id, tourId } = await params;
  const supabase = await createClient();
  const admin = await requireAdmin(`/admin/seasons/${id}/tours/${tourId}`);
  if (!admin) return null;

  let detail;
  try {
    detail = await getTour(supabase, tourId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const offset = await getUtcOffsetMinutes(supabase, admin.id);
  const { tour, season, clubs, matches } = detail;
  const closed = season.status === "closed";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/seasons/${season.id}`} className="text-sm text-muted underline">
          ← {season.name}
        </Link>
        <h1 className="mt-3 text-h3 sm:text-h1">
          {ru.admin.tours.tourN.replace("{n}", String(tour.number))}
          {tour.title ? ` · ${tour.title}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {tour.deadlineAt
            ? `${ru.admin.tours.deadlineIs} ${formatDateTime(tour.deadlineAt, offset)}${tour.deadlineOverride ? ` (${ru.admin.tours.pinned})` : ""}`
            : ru.admin.tours.noDeadline}
          {" · "}
          {ru.admin.tours.timeZoneNote}
        </p>
        {closed && <p className="mt-2 text-sm text-muted">{ru.admin.seasons.closedNote}</p>}
      </div>

      <Card title={ru.admin.tours.settings}>
        <TourForm
          seasonId={season.id}
          tour={{
            id: tour.id,
            number: tour.number,
            title: tour.title,
            deadlineOverride: tour.deadlineOverride,
          }}
          offsetMinutes={offset}
          disabled={closed}
        />
      </Card>

      {!closed && (
        <Card title={ru.admin.matches.newTitle}>
          {clubs.length < 2 ? (
            <p className="text-muted">{ru.admin.matches.needRoster}</p>
          ) : (
            <MatchForm tourId={tour.id} clubs={clubs} offsetMinutes={offset} />
          )}
        </Card>
      )}

      <section aria-labelledby="matches-title" className="flex flex-col gap-4">
        <h2 id="matches-title" className="text-lg sm:text-h3">
          {ru.admin.matches.title}
        </h2>
        {matches.length === 0 ? (
          <p className="text-muted">{ru.admin.matches.empty}</p>
        ) : (
          matches.map((match) => (
            <Card key={match.id} as="article">
              <p className="mb-4 font-semibold">
                {match.homeName} — {match.awayName}
                {match.status === "finished" && (
                  <span className="ml-3">
                    {match.homeScore}:{match.awayScore}
                  </span>
                )}
                <span className="ml-3 text-sm font-normal text-muted">
                  {formatDateTime(match.kickoffAt, offset)} ·{" "}
                  {ru.admin.matches.statuses[match.status]}
                </span>
              </p>
              <MatchForm
                tourId={tour.id}
                clubs={clubs}
                offsetMinutes={offset}
                match={match}
                disabled={closed}
              />
            </Card>
          ))
        )}
      </section>
    </div>
  );
}

export default function AdminTourPage(props: PageProps<"/admin/seasons/[id]/tours/[tourId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <TourContent params={props.params} />
    </Suspense>
  );
}
