import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { MarketNav } from "@/features/manager/components/market-nav";
import { marketNavItems } from "@/features/manager/components/market-nav-items";
import { MarketView } from "@/features/manager/components/market-view";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuctions } from "@/server/services/manager/auction";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/market">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.market.title, robots: { index: false } };
}

async function MarketContent() {
  const { user, offsetMinutes } = await loadMember("/manager/market");
  after(catchUpRounds);
  const auctions = await orMakeClub(() => getAuctions(createAdminClient(), user.id));
  return <MarketView auctions={auctions} offsetMinutes={offsetMinutes} />;
}

export default async function ManagerMarketPage(props: PageProps<"/[locale]/manager/market">) {
  await initLocale(props.params);
  const t = getMessages().manager.market;
  return (
    <ManagerShell title={t.title} lead={t.lead} faq="market">
      <MarketNav
        label={getMessages().manager.marketNav.label}
        items={marketNavItems(getMessages().manager.marketNav)}
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <MarketContent />
      </Suspense>
    </ManagerShell>
  );
}
