import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { MarketView } from "@/features/manager/components/market-view";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getMarket } from "@/server/services/manager/market";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/market">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.market.title, robots: { index: false } };
}

async function MarketContent() {
  const { user, supabase } = await loadMember("/manager/market");
  after(catchUpRounds);
  const market = await orMakeClub(() => getMarket(supabase, user.id));
  return <MarketView market={market} />;
}

export default async function ManagerMarketPage(props: PageProps<"/[locale]/manager/market">) {
  await initLocale(props.params);
  const t = getMessages().manager.market;
  return (
    <ManagerShell title={t.title} lead={t.lead}>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <MarketContent />
      </Suspense>
    </ManagerShell>
  );
}
