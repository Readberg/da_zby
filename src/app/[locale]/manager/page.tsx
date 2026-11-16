import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubView } from "@/features/manager/components/club-view";
import { CreateClubForm } from "@/features/manager/components/create-club-form";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/server/services/current-user";
import { getMyClub } from "@/server/services/manager/club";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.title, description: t.manager.description, robots: { index: false } };
}

/** A signed-in page: the form that makes the club, or the club with its squad. */
async function ManagerContent() {
  const t = getMessages().manager;
  const user = await requireProfile("/manager");
  const view = await getMyClub(await createClient(), user.id);
  if (view.club) return <ClubView view={view} />;
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
    <Container className="flex flex-col gap-6 py-8 sm:py-12 lg:py-20">
      <h1 className="font-display text-4xl uppercase">{t.title}</h1>
      <p className="max-w-prose text-muted">{t.lead}</p>
      <p className="max-w-prose rounded-lg border border-line bg-surface p-4 text-sm text-muted">
        {t.stageNote}
      </p>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ManagerContent />
      </Suspense>
    </Container>
  );
}
