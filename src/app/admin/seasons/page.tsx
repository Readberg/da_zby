import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SeasonCreateForm } from "@/features/admin/components/season-forms";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/time";
import { ru } from "@/messages/ru";
import { listSeasons } from "@/server/services/admin-seasons";
import { listTournaments } from "@/server/services/admin-tournaments";

export const metadata: Metadata = { title: ru.admin.nav.seasons, robots: { index: false } };

async function SeasonsContent() {
  const supabase = await createClient();
  const [{ items }, { items: tournaments }] = await Promise.all([
    listSeasons(supabase),
    listTournaments(supabase),
  ]);

  return (
    <>
      <Card title={ru.admin.seasons.newTitle}>
        <SeasonCreateForm
          tournaments={tournaments.map((t) => ({ id: t.id, name: t.name }))}
          seasons={items.map((s) => ({ id: s.id, name: s.name, tournamentName: s.tournamentName }))}
        />
      </Card>
      {items.length === 0 ? (
        <p className="text-muted">{ru.admin.seasons.empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((season) => (
            <li key={season.id}>
              <Link href={`/admin/seasons/${season.id}`} className="group block">
                <Card as="article" className="h-full transition-shadow group-hover:shadow-soft">
                  <p className="text-sm text-muted">{season.tournamentName}</p>
                  <h2 className="text-lg normal-case">{season.name}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {season.status === "closed"
                      ? `${ru.admin.seasons.closedLabel}${season.closedAt ? ` · ${formatDate(season.closedAt)}` : ""}`
                      : ru.admin.seasons.activeLabel}
                    {" · "}
                    {ru.admin.seasons.counts
                      .replace("{clubs}", String(season.clubsCount))
                      .replace("{tours}", String(season.toursCount))}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AdminSeasonsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 sm:text-h1">{ru.admin.nav.seasons}</h1>
      <p className="max-w-prose text-muted">{ru.admin.seasons.intro}</p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SeasonsContent />
      </Suspense>
    </div>
  );
}
