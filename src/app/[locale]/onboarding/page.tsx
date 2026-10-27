import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NarrowPage } from "@/components/ui/narrow-page";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingForm } from "@/features/profile/components/onboarding-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { requireUser } from "@/server/services/current-user";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/onboarding">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.onboarding.title, robots: { index: false } };
}

async function OnboardingContent({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/onboarding">["searchParams"];
}) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : null);
  const user = await requireUser("/onboarding");

  // The nickname is chosen once; whoever has it has nothing to do here.
  if (user.nickname) redirect(next);

  return <OnboardingForm next={next} />;
}

export default async function OnboardingPage(props: PageProps<"/[locale]/onboarding">) {
  await initLocale(props.params);
  const t = getMessages();
  return (
    <NarrowPage title={t.onboarding.title} intro={t.onboarding.intro}>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <OnboardingContent searchParams={props.searchParams} />
      </Suspense>
    </NarrowPage>
  );
}
