import type { Metadata } from "next";
import { after } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceView } from "@/features/manager/components/finance-view";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { loadMember, orMakeClub } from "@/features/manager/load";
import { catchUpRounds } from "@/server/services/manager/catch-up";
import { getFinance } from "@/server/services/manager/market";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/finance">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.finance.title, robots: { index: false } };
}

async function FinanceContent() {
  const { user, supabase, offsetMinutes } = await loadMember("/manager/finance");
  after(catchUpRounds);
  const finance = await orMakeClub(() => getFinance(supabase, user.id));
  return <FinanceView finance={finance} offsetMinutes={offsetMinutes} />;
}

export default async function ManagerFinancePage(props: PageProps<"/[locale]/manager/finance">) {
  await initLocale(props.params);
  const t = getMessages().manager.finance;
  return (
    <ManagerShell title={t.title} lead={t.lead}>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <FinanceContent />
      </Suspense>
    </ManagerShell>
  );
}
