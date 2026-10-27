import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NarrowPage } from "@/components/ui/narrow-page";
import { Skeleton } from "@/components/ui/skeleton";
import { TelegramLogin } from "@/features/auth/components/telegram-login";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/services/current-user";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.auth.loginTitle, robots: { index: false } };
}

async function LoginContent({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/login">["searchParams"];
}) {
  const t = getMessages();
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : null);

  // Already signed in: nothing to do here.
  if (await getCurrentUser()) redirect(next);

  return <TelegramLogin next={next} error={params.error ? t.auth.errors.telegram : null} />;
}

export default async function LoginPage(props: PageProps<"/[locale]/login">) {
  await initLocale(props.params);
  const t = getMessages();
  return (
    <NarrowPage title={t.auth.loginTitle} intro={t.auth.loginIntro}>
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <LoginContent searchParams={props.searchParams} />
      </Suspense>
    </NarrowPage>
  );
}
