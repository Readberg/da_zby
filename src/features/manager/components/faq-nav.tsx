"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

/**
 * The navigation of the FAQ by sections. The section being read (the last one whose top has
 * passed the upper part of the screen) is highlighted; a button leads back to the top when the
 * page is scrolled down.
 */
export function FaqNav({
  label,
  topLabel,
  sections,
}: {
  label: string;
  topLabel: string;
  sections: { id: string; title: string }[];
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function update() {
      const line = window.innerHeight * 0.3;
      let current = sections[0]?.id ?? "";
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= line) current = section.id;
      }
      setActive(current);
      setScrolled(window.scrollY > 600);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections]);

  return (
    <>
      <nav
        aria-label={label}
        className="sticky top-[4.5rem] z-20 -mx-4 bg-bg px-4 py-2 lg:top-24 lg:mx-0 lg:self-start lg:p-0"
      >
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
          {sections.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={active === section.id ? "location" : undefined}
                className={cx(
                  "inline-flex min-h-10 items-center rounded-sm border px-3 text-sm font-semibold transition-colors hover:bg-surface-hover hover:text-accent lg:w-full",
                  active === section.id
                    ? "border-accent bg-surface text-accent"
                    : "border-line bg-surface lg:border-transparent lg:bg-transparent",
                )}
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {scrolled && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 right-5 z-30 inline-flex h-11 items-center gap-1 rounded-full border border-line bg-surface px-4 text-sm font-semibold shadow-xl transition-colors hover:border-accent hover:text-accent"
        >
          <span aria-hidden="true">↑</span> {topLabel}
        </button>
      )}
    </>
  );
}
