import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentsManager } from "@/features/admin/components/tournaments-manager";
import { createClient } from "@/lib/supabase/server";
import { ru } from "@/messages/ru";
import { listTournaments } from "@/server/services/admin-tournaments";

export const metadata: Metadata = { title: ru.admin.nav.tournaments, robots: { index: false } };

async function TournamentsContent() {
  const { items } = await listTournaments(await createClient());
  return <TournamentsManager initial={items} />;
}

export default function AdminTournamentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 sm:text-h2">{ru.admin.nav.tournaments}</h1>
      <p className="max-w-prose text-muted">{ru.admin.tournaments.intro}</p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <TournamentsContent />
      </Suspense>
    </div>
  );
}
