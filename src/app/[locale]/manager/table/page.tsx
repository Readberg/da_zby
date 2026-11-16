import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LeagueTable } from "@/features/manager/components/league-table";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getLeagueView } from "@/server/services/manager/league";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/table">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.table.title, robots: { index: false } };
}

async function TableContent() {
  const { user, supabase } = await loadMember("/manager/table");
  after(catchUpRounds);
  const view = await orMakeClub(() => getLeagueView(supabase, user.id));
  return <LeagueTable view={view} />;
}

export default async function ManagerTablePage(props: PageProps<"/[locale]/manager/table">) {
  await initLocale(props.params);
  const t = getMessages().manager.table;
  return (
    <ManagerShell title={t.title} lead={t.lead} faq="matches">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <TableContent />
      </Suspense>
    </ManagerShell>
  );
}
