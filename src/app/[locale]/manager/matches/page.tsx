import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchesTable } from "@/features/manager/components/matches-table";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { listMyMatches } from "@/server/services/manager/league";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/matches">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.matchesPage.title, robots: { index: false } };
}

async function MatchesContent() {
  const { user, supabase, offsetMinutes } = await loadMember("/manager/matches");
  after(catchUpRounds);
  const [list, club] = await Promise.all([
    orMakeClub(() => listMyMatches(supabase, user.id)),
    supabase.from("mgr_clubs").select("id").eq("user_id", user.id).maybeSingle(),
  ]);
  return (
    <MatchesTable matches={list.matches} mineId={club.data?.id} offsetMinutes={offsetMinutes} />
  );
}

export default async function ManagerMatchesPage(props: PageProps<"/[locale]/manager/matches">) {
  await initLocale(props.params);
  const t = getMessages().manager.matchesPage;
  return (
    <ManagerShell title={t.title} lead={t.lead} faq="matches">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <MatchesContent />
      </Suspense>
    </ManagerShell>
  );
}
