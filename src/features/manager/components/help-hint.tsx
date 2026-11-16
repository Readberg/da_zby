"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { useManager } from "./manager-provider";

/**
 * A hint: a small circle with a question mark that does not catch the eye. A click, a tap, the
 * keyboard or the pointer over it opens the text; Escape or a click outside closes it. With `faq`
 * the text ends with a link to the matching section of the FAQ of the game.
 */
export function HelpHint({
  children,
  faq,
  className,
}: {
  children: ReactNode;
  /** The id of the section of the FAQ the hint belongs to. */
  faq?: string;
  className?: string;
}) {
  const { t } = useManager();
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const open = pinned || hover;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) {
        setPinned(false);
        setHover(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPinned(false);
        setHover(false);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={root}
      className={cx("relative inline-flex align-middle", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label={t.hints.label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setPinned((value) => !value)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-line text-[11px] font-semibold leading-none text-muted transition-colors hover:border-muted hover:text-ink focus-visible:border-ink focus-visible:text-ink"
      >
        <span aria-hidden="true">?</span>
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute left-0 top-full z-30 mt-2 flex w-72 max-w-[80vw] flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-left text-sm font-normal normal-case tracking-normal text-ink shadow-xl sm:w-80"
        >
          <span>{children}</span>
          {faq && (
            <Link
              href={`/manager/faq#${faq}`}
              className="font-semibold text-accent hover:underline"
            >
              {t.hints.more}
            </Link>
          )}
        </span>
      )}
    </span>
  );
}
