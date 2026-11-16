import type { ReactNode } from "react";
import { ManagerProvider } from "@/features/manager/components/manager-provider";
import { getLocale, getMessages, initLocale } from "@/i18n/server";

/** The texts of the section for its client components (the modal player card, the pitch, hints). */
export default async function ManagerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: LayoutProps<"/[locale]/manager">["params"];
}) {
  await initLocale(params);
  return (
    <ManagerProvider t={getMessages().manager} locale={getLocale()}>
      {children}
    </ManagerProvider>
  );
}
