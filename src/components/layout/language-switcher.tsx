"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LocaleFlag } from "@/components/ui/flags";
import { CheckIcon, ChevronDownIcon, GlobeIcon } from "@/components/ui/icons";
import { EVENTS, track } from "@/lib/analytics";
import { cx } from "@/lib/cx";
import { LOCALES, LOCALE_NAMES, isLocale } from "@/i18n/config";
import { saveLocale } from "@/i18n/cookie";
import { useLocale, useMessages } from "@/i18n/client";

/**
 * The language of the interface (D-088): the choice is kept in a cookie and the page is loaded
 * again, so every server-rendered text, date and number follows it. The address does not change.
 * A button opens a small menu in the site's style (not the system list): it opens upwards because
 * the footer is at the bottom, closes on Escape, Tab or a click outside, and works with the arrows.
 * In the header ("header") it is compact: the flag and the code, and the menu opens downwards.
 */
export function LanguageSwitcher({
  reload = () => window.location.reload(),
  variant = "footer",
}: {
  reload?: () => void;
  variant?: "footer" | "header";
}) {
  const compact = variant === "header";
  const t = useMessages();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    items.current[LOCALES.indexOf(locale)]?.focus();
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, locale]);

  function choose(value: string) {
    setOpen(false);
    if (!isLocale(value) || value === locale) {
      trigger.current?.focus();
      return;
    }
    saveLocale(value);
    track(EVENTS.languageChange, { language: value });
    reload();
  }

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const at = items.current.findIndex((item) => item === document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items.current[(at + step + LOCALES.length) % LOCALES.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items.current[event.key === "Home" ? 0 : LOCALES.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className="relative w-fit">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={compact ? undefined : `${t.footer.languageLabel}: ${LOCALE_NAMES[locale]}`}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          "inline-flex min-h-11 cursor-pointer items-center text-ink transition-colors",
          compact
            ? "gap-2 rounded-sm border border-line px-3 text-sm font-semibold uppercase tracking-wide hover:bg-surface-hover"
            : "gap-3 rounded-md border border-line bg-bg px-4 hover:border-muted",
        )}
      >
        {compact ? (
          <>
            <LocaleFlag locale={locale} className="h-4 w-6 rounded-[2px]" />
            {/* The code is for the eye; the name for assistive technology (the code is not a word). */}
            <span aria-hidden="true">{locale}</span>
            <span className="sr-only">
              {t.footer.languageLabel}: {LOCALE_NAMES[locale]}
            </span>
          </>
        ) : (
          <>
            <GlobeIcon className="h-5 w-5" />
            {LOCALE_NAMES[locale]}
          </>
        )}
        <ChevronDownIcon
          className={cx("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t.footer.languageLabel}
          onKeyDown={onMenuKey}
          className={cx(
            "absolute z-20 min-w-full animate-page-in rounded-md border border-line bg-bg p-1",
            compact
              ? "right-0 top-full mt-2 min-w-40 origin-top"
              : "bottom-full left-0 mb-2 origin-bottom",
          )}
        >
          {LOCALES.map((code, index) => (
            <button
              key={code}
              ref={(node) => {
                items.current[index] = node;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={code === locale}
              lang={code}
              onClick={() => choose(code)}
              className={cx(
                "flex min-h-11 w-full cursor-pointer items-center justify-between gap-6 rounded-sm px-3 text-left transition-colors hover:bg-accent/30 focus-visible:bg-accent/30",
                code === locale && "font-semibold",
              )}
            >
              <span className="inline-flex items-center gap-3">
                {compact && <LocaleFlag locale={code} className="h-4 w-6 rounded-[2px]" />}
                {LOCALE_NAMES[code]}
              </span>
              {code === locale && <CheckIcon className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
