import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { TelegramLogin } from "@/features/auth/components/telegram-login";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { ru } from "@/messages/ru";
import { getCurrentUser } from "@/server/services/current-user";

export const metadata: Metadata = { title: ru.auth.loginTitle, robots: { index: false } };

async function LoginContent({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : null);

  // Already signed in: nothing to do here.
  if (await getCurrentUser()) redirect(next);

  return <TelegramLogin next={next} error={params.error ? ru.auth.errors.telegram : null} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Container className="flex flex-col gap-4 py-8 sm:py-12">
      <h1 className="text-h3 sm:text-h1">{ru.auth.loginTitle}</h1>
      <p className="max-w-prose text-muted">{ru.auth.loginIntro}</p>
      <Suspense fallback={<Skeleton className="h-32 max-w-md" />}>
        <LoginContent searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}
