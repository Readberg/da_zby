import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NarrowPage } from "@/components/ui/narrow-page";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingForm } from "@/features/profile/components/onboarding-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { ru } from "@/messages/ru";
import { requireUser } from "@/server/services/current-user";

export const metadata: Metadata = { title: ru.onboarding.title, robots: { index: false } };

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

export default function OnboardingPage(props: PageProps<"/[locale]/onboarding">) {
  return (
    <NarrowPage title={ru.onboarding.title} intro={ru.onboarding.intro}>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <OnboardingContent searchParams={props.searchParams} />
      </Suspense>
    </NarrowPage>
  );
}
