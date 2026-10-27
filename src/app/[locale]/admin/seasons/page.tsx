import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SeasonsManager } from "@/features/admin/components/seasons-manager";
import { createClient } from "@/lib/supabase/server";
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
    <SeasonsManager
      initial={items}
      tournaments={tournaments.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}

export default function AdminSeasonsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 sm:text-h2">{ru.admin.nav.seasons}</h1>
      <p className="max-w-prose text-muted">{ru.admin.seasons.intro}</p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SeasonsContent />
      </Suspense>
    </div>
  );
}
