import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchReport } from "@/features/manager/components/match-report";
import { loadMember } from "@/features/manager/load";
import { ApiError } from "@/server/api/v1/problem";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getMatch } from "@/server/services/manager/league";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/matches/[id]">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.matchesPage.title, robots: { index: false } };
}

async function MatchContent({
  params,
}: {
  params: PageProps<"/[locale]/manager/matches/[id]">["params"];
}) {
  const { id } = await params;
  const { supabase } = await loadMember(`/manager/matches/${id}`);
  if (!UUID.test(id)) notFound();
  after(catchUpRounds);
  const match = await getMatch(supabase, id).catch((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 404) notFound();
    throw cause;
  });
  return <MatchReport match={match} />;
}

export default async function ManagerMatchPage(props: PageProps<"/[locale]/manager/matches/[id]">) {
  await initLocale(props.params);
  const t = getMessages().manager;
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12 lg:py-20">
      <Link href="/manager/matches" className="text-sm underline">
        ← {t.matchPage.back}
      </Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <MatchContent params={props.params} />
      </Suspense>
    </Container>
  );
}
