import { connection } from "next/server";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { points } from "@/lib/plural";
import { ru } from "@/messages/ru";
import { getHomeCached } from "@/server/services/home.cached";

/** Defaults of the product (PRODUCT §7), shown until a tournament with its own points exists. */
const DEFAULT_POINTS = { exact: 3, outcome: 1 };

function Steps({ exact, outcome }: { exact: number; outcome: number }) {
  const steps = [
    { title: ru.home.steps.one.title, text: ru.home.steps.one.text },
    { title: ru.home.steps.two.title, text: ru.home.steps.two.text },
    {
      title: ru.home.steps.three.title,
      text: ru.home.steps.three.text
        .replace("{exact}", points(exact))
        .replace("{outcome}", points(outcome)),
    },
  ];
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.title}>
          <Card as="article" className="h-full">
            <p
              aria-hidden="true"
              className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-accent font-display text-lg font-bold text-black"
            >
              {index + 1}
            </p>
            <h3 className="text-lg normal-case">{step.title}</h3>
            <p className="mt-2 text-muted">{step.text}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export async function StepsWithPoints() {
  await connection();
  const { pub } = await getHomeCached();
  return (
    <Steps
      exact={pub.tournament?.pointsExact ?? DEFAULT_POINTS.exact}
      outcome={pub.tournament?.pointsOutcome ?? DEFAULT_POINTS.outcome}
    />
  );
}

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="flex scroll-mt-20 flex-col gap-6">
      <h2 id="how-title" className="text-h3 sm:text-h2">
        {ru.home.howTitle}
      </h2>
      <Suspense fallback={<Steps exact={DEFAULT_POINTS.exact} outcome={DEFAULT_POINTS.outcome} />}>
        <StepsWithPoints />
      </Suspense>
    </section>
  );
}
