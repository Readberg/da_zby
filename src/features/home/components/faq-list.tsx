"use client";

import { useId, useState } from "react";
import { EVENTS, track } from "@/lib/analytics";
import { cx } from "@/lib/cx";

export type FaqEntry = { q: string; a: string };

/** Accordion: one answer open at a time, the first one open on arrival. */
export function FaqList({ items }: { items: readonly FaqEntry[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const id = useId();

  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((item, index) => {
        const open = openIndex === index;
        return (
          <li key={item.q} className="py-2">
            <h3 className="text-base normal-case">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`${id}-${index}`}
                onClick={() => {
                  if (!open) track(EVENTS.faqOpen, { question: index + 1 });
                  setOpenIndex(open ? null : index);
                }}
                className="flex min-h-12 w-full cursor-pointer items-center gap-4 text-left font-semibold"
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xl transition-colors duration-200",
                    open && "bg-accent text-black",
                  )}
                >
                  {open ? "−" : "+"}
                </span>
                {item.q}
              </button>
            </h3>
            <div
              id={`${id}-${index}`}
              hidden={!open}
              className="animate-page-in pb-3 pl-12 text-muted"
            >
              {item.a}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
