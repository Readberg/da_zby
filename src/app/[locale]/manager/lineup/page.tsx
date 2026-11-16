import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LineupForm } from "@/features/manager/components/lineup-form";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { injuredNotes } from "@/features/manager/injuries";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { formatDateTime } from "@/lib/local-time";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getMyClub } from "@/server/services/manager/club";
import { getLineup } from "@/server/services/manager/league";
import { getLocale, getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/lineup">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.lineupPage.title, robots: { index: false } };
}

async function LineupContent() {
  const t = getMessages().manager;
  const { user, supabase, offsetMinutes } = await loadMember("/manager/lineup");
  after(catchUpRounds);
  const [view, lineup] = await orMakeClub(() =>
    Promise.all([getMyClub(supabase, user.id), getLineup(supabase, user.id)]),
  );
  const notes = injuredNotes(view.players, (until) =>
    t.lineupPage.injured.replace("{date}", formatDateTime(until, offsetMinutes, getLocale())),
  );
  return (
    <LineupForm
      injuredNotes={notes}
      // A new lineup of the same club after a save must not keep the old selection.
      key={`${lineup.formation}-${lineup.mentality}-${lineup.playerIds.join(",")}-${lineup.saved}`}
      t={t}
      players={view.players}
      lineup={lineup}
      until={
        lineup.nextKickoffAt
          ? formatDateTime(lineup.nextKickoffAt, offsetMinutes, getLocale())
          : null
      }
    />
  );
}

export default async function ManagerLineupPage(props: PageProps<"/[locale]/manager/lineup">) {
  await initLocale(props.params);
  const t = getMessages().manager.lineupPage;
  return (
    <ManagerShell title={t.title} lead={t.lead}>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <LineupContent />
      </Suspense>
    </ManagerShell>
  );
}
