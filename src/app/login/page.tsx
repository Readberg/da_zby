import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NarrowPage } from "@/components/ui/narrow-page";
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
    <NarrowPage title={ru.auth.loginTitle} intro={ru.auth.loginIntro}>
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <LoginContent searchParams={props.searchParams} />
      </Suspense>
    </NarrowPage>
  );
}
