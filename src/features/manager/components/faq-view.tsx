import { getMessages } from "@/i18n/server";
import { FaqNav } from "./faq-nav";

/**
 * The FAQ of the game: the sections are listed in a navigation next to (on a phone: above) the
 * answers, and every section has an anchor, so that a hint can lead straight to its part.
 */
export function FaqView() {
  const t = getMessages().manager.faq;
  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
      <FaqNav
        label={t.nav}
        topLabel={t.top}
        sections={t.sections.map(({ id, title }) => ({ id, title }))}
      />

      <div className="flex flex-col gap-10">
        {t.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`faq-${section.id}`}
            className="scroll-mt-24"
          >
            <h2 id={`faq-${section.id}`} className="mb-4 text-h3">
              {section.title}
            </h2>
            <dl className="flex flex-col gap-5">
              {section.items.map((item) => (
                <div key={item.q} className="flex flex-col gap-1">
                  <dt className="font-semibold">{item.q}</dt>
                  <dd className="max-w-prose text-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
