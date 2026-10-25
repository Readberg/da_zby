import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentForm } from "@/features/admin/components/tournament-form";
import { createClient } from "@/lib/supabase/server";
import { ru } from "@/messages/ru";
import { listTournaments } from "@/server/services/admin-tournaments";

export const metadata: Metadata = { title: ru.admin.nav.tournaments, robots: { index: false } };

async function TournamentsContent() {
  const { items } = await listTournaments(await createClient());

  return (
    <>
      <Card title={ru.admin.tournaments.newTitle}>
        <TournamentForm />
      </Card>
      {items.length === 0 ? (
        <p className="text-muted">{ru.admin.tournaments.empty}</p>
      ) : (
        items.map((tournament) => (
          <Card key={tournament.id} as="article" title={tournament.name}>
            <p className="mb-4 text-sm text-muted">
              {tournament.slug} ·{" "}
              {tournament.isActive
                ? ru.admin.tournaments.activeLabel
                : ru.admin.tournaments.inactiveLabel}
            </p>
            <TournamentForm tournament={tournament} />
          </Card>
        ))
      )}
    </>
  );
}

export default function AdminTournamentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 sm:text-h1">{ru.admin.nav.tournaments}</h1>
      <p className="max-w-prose text-muted">{ru.admin.tournaments.intro}</p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <TournamentsContent />
      </Suspense>
    </div>
  );
}
