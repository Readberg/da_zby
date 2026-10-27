import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

/**
 * Centred single-task page (sign-in, choosing a nickname): a big heading, one line of context and
 * the form in a soft card. One screen, one main action.
 */
export function NarrowPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <Container className="flex flex-col items-center gap-4 py-10 text-center sm:py-16">
      <h1 className="font-display text-[clamp(2rem,7vw,3.5rem)] uppercase leading-none">{title}</h1>
      {intro && <p className="max-w-md text-lg text-muted">{intro}</p>}
      <div className="mt-2 flex w-full max-w-md flex-col items-center rounded-lg border border-line bg-surface p-6 text-left sm:p-8">
        {children}
      </div>
    </Container>
  );
}
