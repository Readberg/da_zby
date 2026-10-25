import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubsManager } from "@/features/admin/components/clubs-manager";
import { createClient } from "@/lib/supabase/server";
import { ru } from "@/messages/ru";
import { listClubs } from "@/server/services/admin-clubs";

export const metadata: Metadata = { title: ru.admin.nav.clubs, robots: { index: false } };

async function ClubsContent() {
  const { items } = await listClubs(await createClient());
  return <ClubsManager initial={items} />;
}

export default function AdminClubsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 sm:text-h2">{ru.admin.nav.clubs}</h1>
      <p className="max-w-prose text-muted">{ru.admin.clubs.intro}</p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <ClubsContent />
      </Suspense>
    </div>
  );
}
