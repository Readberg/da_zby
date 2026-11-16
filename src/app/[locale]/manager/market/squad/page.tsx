import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractsView } from "@/features/manager/components/contracts-view";
import { MarketNav } from "@/features/manager/components/market-nav";
import { marketNavItems } from "@/features/manager/components/market-nav-items";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { createAdminClient } from "@/lib/supabase/admin";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getContracts } from "@/server/services/manager/contracts";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/market/squad">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.contracts.title, robots: { index: false } };
}

async function Content() {
  const { user, offsetMinutes } = await loadMember("/manager/market/squad");
  after(catchUpRounds);
  const data = await orMakeClub(() => getContracts(createAdminClient(), user.id));
  return <ContractsView contracts={data} offsetMinutes={offsetMinutes} />;
}

export default async function ManagerContractsViewPage(
  props: PageProps<"/[locale]/manager/market/squad">,
) {
  await initLocale(props.params);
  const t = getMessages().manager;
  return (
    <ManagerShell title={t.contracts.title} lead={t.contracts.lead} faq="contracts">
      <MarketNav label={t.marketNav.label} items={marketNavItems(t.marketNav)} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </ManagerShell>
  );
}
