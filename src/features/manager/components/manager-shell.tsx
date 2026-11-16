import { Container } from "@/components/ui/container";
import { getMessages } from "@/i18n/server";
import { ManagerTabs } from "./manager-tabs";

/** The frame of every page of the football manager: title and the tabs between its pages. */
export function ManagerShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  const t = getMessages().manager;
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12 lg:py-20">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl uppercase">{title}</h1>
        {lead && <p className="max-w-prose text-muted">{lead}</p>}
      </div>
      <ManagerTabs
        label={t.title}
        tabs={[
          { href: "/manager", label: t.hub.club },
          { href: "/manager/lineup", label: t.hub.lineup },
          { href: "/manager/training", label: t.hub.training },
          { href: "/manager/matches", label: t.hub.matches },
          { href: "/manager/table", label: t.hub.table },
        ]}
      />
      {children}
    </Container>
  );
}
