import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubView } from "@/features/manager/components/club-view";
import { CreateClubForm } from "@/features/manager/components/create-club-form";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { loadMember } from "@/features/manager/load";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getMyClub, placeClubQuietly } from "@/server/services/manager/club";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.title, description: t.manager.description, robots: { index: false } };
}

/** A signed-in page: the form that makes the club, or the club with its next match and squad. */
async function ManagerContent() {
  const t = getMessages().manager;
  const { user, supabase, offsetMinutes } = await loadMember("/manager");
  let view = await getMyClub(supabase, user.id);

  // A club made before leagues existed (or whose place could not be found) gets its league now.
  if (view.club && view.leagueNumber === null && serverEnv.SUPABASE_SECRET_KEY) {
    if (await placeClubQuietly(createAdminClient(), view.club.id)) {
      view = await getMyClub(supabase, user.id);
    }
  }
  // The scheduler plays the rounds; a visit after kickoff is the safety net.
  after(catchUpRounds);

  if (view.club) return <ClubView view={view} offsetMinutes={offsetMinutes} />;
  return (
    <section aria-labelledby="create-title" className="flex flex-col gap-4">
      <h2 id="create-title" className="text-h3">
        {t.createTitle}
      </h2>
      <p className="max-w-prose text-muted">{t.createLead}</p>
      <CreateClubForm t={t} />
    </section>
  );
}

export default async function ManagerPage(props: PageProps<"/[locale]/manager">) {
  await initLocale(props.params);
  const t = getMessages().manager;
  return (
    <ManagerShell title={t.title} lead={t.lead}>
      <p className="max-w-prose rounded-lg border border-line bg-surface p-4 text-sm text-muted">
        {t.scheduleNote}
      </p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ManagerContent />
      </Suspense>
    </ManagerShell>
  );
}
