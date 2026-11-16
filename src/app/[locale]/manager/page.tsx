import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubView } from "@/features/manager/components/club-view";
import { CreateClubForm } from "@/features/manager/components/create-club-form";
import { HelpHint } from "@/features/manager/components/help-hint";
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

  if (view.club) return <ClubView view={view} offsetMinutes={offsetMinutes} userId={user.id} />;
  return (
    <section aria-labelledby="create-title" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 id="create-title" className="text-h3">
          {t.createTitle}
        </h2>
        <HelpHint faq="start">{t.createLead}</HelpHint>
      </div>
      <CreateClubForm />
    </section>
  );
}

export default async function ManagerPage(props: PageProps<"/[locale]/manager">) {
  await initLocale(props.params);
  const t = getMessages().manager;
  return (
    <ManagerShell title={t.title} lead={t.lead} faq="start">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ManagerContent />
      </Suspense>
    </ManagerShell>
  );
}
