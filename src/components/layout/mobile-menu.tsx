"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { useAppPathname } from "@/i18n/use-app-pathname";

/**
 * The burger of the header on screens narrower than 1024 px: a button that unfolds a panel with the
 * links and the account actions (given as children, rendered on the server). It folds on Escape and
 * when the visitor goes to another page.
 */
export function MobileMenu({ label, children }: { label: string; children: ReactNode }) {
  const pathname = useAppPathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);

  // A new page: fold the panel (state is derived while rendering, no effect needed).
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm border border-line text-ink transition-colors duration-200 hover:bg-surface-hover"
      >
        {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-full max-h-[calc(100vh-4.5rem)] animate-page-in overflow-y-auto border-b border-line bg-bg"
        >
          {children}
        </div>
      )}
    </div>
  );
}
