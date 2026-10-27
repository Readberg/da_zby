import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/features/admin/components/status-pill";
import { RosterForm, SeasonActions } from "@/features/admin/components/season-forms";
import { TourForm } from "@/features/admin/components/tour-forms";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/local-time";
import { formatDate } from "@/lib/time";
import { ru } from "@/messages/ru";
import { ApiError } from "@/server/api/v1/problem";
import { listClubs } from "@/server/services/admin-clubs";
import { getSeason } from "@/server/services/admin-seasons";
import { requireAdmin } from "@/server/services/current-user";
import { getUtcOffsetMinutes } from "@/server/services/profiles";

export const metadata: Metadata = { title: ru.admin.nav.seasons, robots: { index: false } };

async function SeasonContent({
  params,
}: {
  params: PageProps<"/[locale]/admin/seasons/[id]">["params"];
}) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = await requireAdmin(`/admin/seasons/${id}`);
  if (!admin) return null;

  let detail;
  try {
    detail = await getSeason(supabase, id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const [{ items: clubs }, offset] = await Promise.all([
    listClubs(supabase),
    getUtcOffsetMinutes(supabase, admin.id),
  ]);
  const { season, tours } = detail;
  const closed = season.status === "closed";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/seasons" className="text-sm text-muted underline">
          ← {ru.admin.nav.seasons}
        </Link>
        <p className="mt-3 text-sm text-muted">{season.tournamentName}</p>
        <h1 className="text-h3 sm:text-h2">{season.name}</h1>
        <p className="mt-2 text-sm text-muted">
          <StatusPill tone={closed ? "muted" : "ok"}>
            {closed ? ru.admin.seasons.closedLabel : ru.admin.seasons.activeLabel}
          </StatusPill>
          {season.closedAt && <span className="ml-2">{formatDate(season.closedAt, offset)}</span>}
        </p>
      </div>

      <Card title={ru.admin.seasons.stateTitle}>
        <SeasonActions seasonId={season.id} status={season.status} />
        {closed && <p className="mt-3 text-sm text-muted">{ru.admin.seasons.closedNote}</p>}
      </Card>

      <Card title={ru.admin.seasons.rosterTitle}>
        <RosterForm
          seasonId={season.id}
          clubs={clubs.map((c) => ({ id: c.id, name: c.name }))}
          selected={detail.clubIds}
          disabled={closed}
        />
      </Card>

      <Card title={ru.admin.tours.title}>
        {!closed && (
          <div className="mb-6">
            <TourForm seasonId={season.id} offsetMinutes={offset} />
          </div>
        )}
        {tours.length === 0 ? (
          <p className="text-muted">{ru.admin.tours.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {tours.map((tour) => (
              <li key={tour.id}>
                <Link
                  href={`/admin/seasons/${season.id}/tours/${tour.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 hover:text-muted"
                >
                  <span className="font-semibold">
                    {ru.admin.tours.tourN.replace("{n}", String(tour.number))}
                    {tour.title ? ` · ${tour.title}` : ""}
                  </span>
                  <span className="text-sm text-muted">
                    {ru.admin.tours.matchesCount.replace("{n}", String(tour.matchesCount))}
                    {tour.deadlineAt
                      ? ` · ${ru.admin.tours.deadlineShort} ${formatDateTime(tour.deadlineAt, offset)}`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function AdminSeasonPage(props: PageProps<"/[locale]/admin/seasons/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SeasonContent params={props.params} />
    </Suspense>
  );
}
