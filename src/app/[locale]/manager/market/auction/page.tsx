import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuctionView } from "@/features/manager/components/auction-view";
import { MarketNav } from "@/features/manager/components/market-nav";
import { marketNavItems } from "@/features/manager/components/market-nav-items";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { createAdminClient } from "@/lib/supabase/admin";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getAuctions } from "@/server/services/manager/auction";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/market/auction">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.auction.title, robots: { index: false } };
}

async function Content() {
  const { user, offsetMinutes } = await loadMember("/manager/market/auction");
  after(catchUpRounds);
  const data = await orMakeClub(() => getAuctions(createAdminClient(), user.id));
  return <AuctionView auctions={data} offsetMinutes={offsetMinutes} />;
}

export default async function ManagerAuctionViewPage(
  props: PageProps<"/[locale]/manager/market/auction">,
) {
  await initLocale(props.params);
  const t = getMessages().manager;
  return (
    <ManagerShell title={t.auction.title} lead={t.auction.lead}>
      <MarketNav label={t.marketNav.label} items={marketNavItems(t.marketNav)} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </ManagerShell>
  );
}
