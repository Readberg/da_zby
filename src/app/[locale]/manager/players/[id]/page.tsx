import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerCard } from "@/features/manager/components/player-card";
import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/server/api/v1/problem";
import { requireProfile } from "@/server/services/current-user";
import { getMyPlayer } from "@/server/services/manager/club";
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
  await requireProfile(`/manager/players/${id}`);
  if (!UUID.test(id)) notFound();
  const player = await getMyPlayer(await createClient(), id).catch((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 404) notFound();
    throw cause;
  });
  return <PlayerCard player={player} />;
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
