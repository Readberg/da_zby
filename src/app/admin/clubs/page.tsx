import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubForm } from "@/features/admin/components/club-form";
import { createClient } from "@/lib/supabase/server";
import { ru } from "@/messages/ru";
import { listClubs } from "@/server/services/admin-clubs";

export const metadata: Metadata = { title: ru.admin.nav.clubs, robots: { index: false } };

async function ClubsContent() {
  const { items } = await listClubs(await createClient());

  return (
    <>
      <Card title={ru.admin.clubs.newTitle}>
        <ClubForm />
      </Card>
      {items.length === 0 ? (
        <p className="text-muted">{ru.admin.clubs.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((club) => (
            <li key={club.id}>
              <Card as="article">
                <ClubForm club={club} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function AdminClubsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h3 sm:text-h1">{ru.admin.nav.clubs}</h1>
      <p className="max-w-prose text-muted">{ru.admin.clubs.intro}</p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <ClubsContent />
      </Suspense>
    </div>
  );
}
