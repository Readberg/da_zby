import { getMessages } from "@/i18n/server";

/**
 * The FAQ of the game: the sections are listed in a navigation next to (on a phone: above) the
 * answers, and every section has an anchor, so that a hint can lead straight to its part.
 */
export function FaqView() {
  const t = getMessages().manager.faq;
  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
      <nav aria-label={t.nav} className="lg:sticky lg:top-24 lg:self-start">
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
          {t.sections.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                className="inline-flex min-h-10 items-center rounded-sm border border-line bg-surface px-3 text-sm font-semibold transition-colors hover:bg-surface-hover hover:text-accent lg:w-full lg:border-transparent lg:bg-transparent"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

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
