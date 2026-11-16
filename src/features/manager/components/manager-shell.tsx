import { Container } from "@/components/ui/container";
import { getMessages } from "@/i18n/server";
import { HelpHint } from "./help-hint";
import { ManagerTabs } from "./manager-tabs";

/**
 * The frame of every page of the football manager: the title (the explanation of the page is a
 * hint in a small circle next to it) and the tabs between its pages.
 */
export function ManagerShell({
  title,
  lead,
  faq,
  children,
}: {
  title: string;
  /** The explanation of the page; shown in a hint, not in the page. */
  lead?: string;
  /** The section of the FAQ the hint links to. */
  faq?: string;
  children: React.ReactNode;
}) {
  const t = getMessages().manager;
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12 lg:py-20">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-4xl uppercase">{title}</h1>
        {lead && <HelpHint faq={faq}>{lead}</HelpHint>}
      </div>
      <ManagerTabs
        label={t.title}
        tabs={[
          { href: "/manager", label: t.hub.club },
          { href: "/manager/lineup", label: t.hub.lineup },
          { href: "/manager/training", label: t.hub.training },
          { href: "/manager/matches", label: t.hub.matches },
          { href: "/manager/table", label: t.hub.table },
          { href: "/manager/finance", label: t.hub.finance },
          { href: "/manager/market", label: t.hub.market },
          { href: "/manager/faq", label: t.hub.faq },
        ]}
      />
      {children}
    </Container>
  );
}
