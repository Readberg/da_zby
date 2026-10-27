"use client";

import { useEffect } from "react";

/**
 * Lifts the first-visit cover when the page has hydrated and its fonts are in. The normal way is the
 * inline script of SiteLoader, but pages that the browser renders itself (the 404 shell Next sends
 * for an unknown address) never run inline scripts, so without this the cover would stay for its
 * full timer.
 */
export function CoverRelease() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.hasAttribute("data-ready")) return;
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const timer = new Promise((resolve) => setTimeout(resolve, 1500));
    let cancelled = false;
    void Promise.race([fonts, timer]).then(() => {
      if (!cancelled) root.setAttribute("data-ready", "");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
