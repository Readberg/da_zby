import type { Metadata } from "next";
import { FaqView } from "@/features/manager/components/faq-view";
import { ManagerShell } from "@/features/manager/components/manager-shell";
import { getMessages, initLocale, messagesFor } from "@/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manager/faq">): Promise<Metadata> {
  const t = await messagesFor(params);
  return { title: t.manager.faq.title, description: t.manager.faq.lead };
}

/** The rules of the game with the numbers; open to everybody, signed in or not. */
export default async function ManagerFaqPage(props: PageProps<"/[locale]/manager/faq">) {
  await initLocale(props.params);
  const t = getMessages().manager.faq;
  return (
    <ManagerShell title={t.title} lead={t.lead}>
      <FaqView />
    </ManagerShell>
  );
}
