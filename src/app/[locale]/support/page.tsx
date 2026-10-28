import type { Metadata } from "next";
import Link from "next/link";
import { NarrowPage } from "@/components/ui/narrow-page";
import { buttonClasses } from "@/components/ui/button";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/support">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.support.title, description: t.support.description, robots: { index: false } };
}

/** Placeholder behind the "Support" button of the header until the real page is made. */
export default async function SupportPage(props: PageProps<"/[locale]/support">) {
  await initLocale(props.params);
  const t = getMessages();
  return (
    <NarrowPage title={t.support.title} intro={t.support.soon}>
      <Link href="/" className={buttonClasses("secondary", "w-full")}>
        {t.support.toHome}
      </Link>
    </NarrowPage>
  );
}
