import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { ScorersTable } from "@/features/manager/components/scorers-table";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { createAdminClient } from "@/lib/supabase/admin";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getScorers } from "@/server/services/manager/stats";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/scorers">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.stats.scorers.title, robots: { index: false } };
}

async function ScorersContent() {
  const { user } = await loadMember("/manager/scorers");
  after(catchUpRounds);
  const view = await orMakeClub(() => getScorers(createAdminClient(), user.id));
  return <ScorersTable view={view} />;
}

export default async function ManagerScorersPage(props: PageProps<"/[locale]/manager/scorers">) {
  await initLocale(props.params);
  const t = getMessages().manager.stats.scorers;
  return (
    <ManagerShell title={t.title} lead={t.lead} faq="matches">
      <Link href="/manager/table" className="text-sm underline">
        ← {t.back}
      </Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ScorersContent />
      </Suspense>
    </ManagerShell>
  );
}
