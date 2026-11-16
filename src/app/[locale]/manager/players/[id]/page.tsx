import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerCard } from "@/features/manager/components/player-card";
import { ApiError } from "@/server/api/v1/problem";
import { loadMember } from "@/features/manager/load";
import { getMyPlayer } from "@/server/services/manager/club";
import { getPlayerStats } from "@/server/services/manager/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/players/[id]">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.title, robots: { index: false } };
}

async function PlayerContent({
  params,
}: {
  params: PageProps<"/[locale]/manager/players/[id]">["params"];
}) {
  const { id } = await params;
  const { user, supabase, offsetMinutes } = await loadMember(`/manager/players/${id}`);
  if (!UUID.test(id)) notFound();
  const player = await getMyPlayer(supabase, id).catch((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 404) notFound();
    throw cause;
  });
  const stats = await getPlayerStats(createAdminClient(), user.id, id).catch(() => null);
  return <PlayerCard player={player} offsetMinutes={offsetMinutes} stats={stats} />;
}

export default async function PlayerPage(props: PageProps<"/[locale]/manager/players/[id]">) {
  await initLocale(props.params);
  const t = getMessages().manager;
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12 lg:py-20">
      <Link href="/manager" className="text-sm underline">
        ← {t.back}
      </Link>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <PlayerContent params={props.params} />
      </Suspense>
    </Container>
  );
}
