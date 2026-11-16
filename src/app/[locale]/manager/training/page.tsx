import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { TrainingForm } from "@/features/manager/components/training-form";
import { injuredNotes } from "@/features/manager/injuries";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { formatDateTime } from "@/lib/local-time";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getMyClub } from "@/server/services/manager/club";
import { getLineup } from "@/server/services/manager/league";
import { getLocale, getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/training">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.trainingPage.title, robots: { index: false } };
}

async function TrainingContent() {
  const t = getMessages().manager;
  const { user, supabase, offsetMinutes } = await loadMember("/manager/training");
  after(catchUpRounds);
  const [view, lineup] = await orMakeClub(() =>
    Promise.all([getMyClub(supabase, user.id), getLineup(supabase, user.id)]),
  );
  const notes = injuredNotes(view.players, (until) =>
    t.trainingPage.injured.replace("{date}", formatDateTime(until, offsetMinutes, getLocale())),
  );
  return <TrainingForm players={view.players} locked={lineup.locked} injuredNotes={notes} />;
}

export default async function ManagerTrainingPage(props: PageProps<"/[locale]/manager/training">) {
  await initLocale(props.params);
  const t = getMessages().manager.trainingPage;
  return (
    <ManagerShell title={t.title} lead={`${t.lead} ${t.rules}`} faq="training">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <TrainingContent />
      </Suspense>
    </ManagerShell>
  );
}
