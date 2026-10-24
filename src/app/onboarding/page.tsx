import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingForm } from "@/features/profile/components/onboarding-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { ru } from "@/messages/ru";
import { requireUser } from "@/server/services/current-user";

export const metadata: Metadata = { title: ru.onboarding.title, robots: { index: false } };

async function OnboardingContent({
  searchParams,
}: {
  searchParams: PageProps<"/onboarding">["searchParams"];
}) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : null);
  const user = await requireUser("/onboarding");

  // The nickname is chosen once; whoever has it has nothing to do here.
  if (user.nickname) redirect(next);

  return <OnboardingForm next={next} />;
}

export default function OnboardingPage(props: PageProps<"/onboarding">) {
  return (
    <Container className="flex flex-col gap-4 py-8 sm:py-12">
      <h1 className="text-h3 sm:text-h1">{ru.onboarding.title}</h1>
      <p className="max-w-prose text-muted">{ru.onboarding.intro}</p>
      <Suspense fallback={<Skeleton className="h-40 max-w-md" />}>
        <OnboardingContent searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
