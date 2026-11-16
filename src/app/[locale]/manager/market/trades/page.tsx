import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TradesView } from "@/features/manager/components/trades-view";
import { MarketNav } from "@/features/manager/components/market-nav";
import { marketNavItems } from "@/features/manager/components/market-nav-items";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { createAdminClient } from "@/lib/supabase/admin";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getTrades } from "@/server/services/manager/trade";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/market/trades">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.trade.title, robots: { index: false } };
}

async function Content() {
  const { user, offsetMinutes } = await loadMember("/manager/market/trades");
  after(catchUpRounds);
  const data = await orMakeClub(() => getTrades(createAdminClient(), user.id));
  return <TradesView trades={data} offsetMinutes={offsetMinutes} />;
}

export default async function ManagerTradesViewPage(
  props: PageProps<"/[locale]/manager/market/trades">,
) {
  await initLocale(props.params);
  const t = getMessages().manager;
  return (
    <ManagerShell title={t.trade.title} lead={t.trade.lead}>
      <MarketNav label={t.marketNav.label} items={marketNavItems(t.marketNav)} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </ManagerShell>
  );
}
