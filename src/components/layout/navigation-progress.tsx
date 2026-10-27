"use client";

import { useAppPathname } from "@/i18n/use-app-pathname";
import { useEffect, useState } from "react";

/**
 * Thin accent bar at the top of the page: appears as soon as an internal link is clicked and
 * finishes when the new page has arrived, so slow server rendering never looks like a freeze.
 */
export function NavigationProgress() {
  const pathname = useAppPathname();
  const [loadingFor, setLoadingFor] = useState<string | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      setLoadingFor(window.location.pathname);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const active = loadingFor !== null && loadingFor === pathname;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
      data-active={active || undefined}
      data-testid="navigation-progress"
    >
      <div
        className={
          active
            ? "h-full origin-left animate-progress bg-accent"
            : "h-full origin-left scale-x-0 bg-accent opacity-0 transition-opacity duration-300"
        }
      />
    </div>
  );
}
