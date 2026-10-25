"use client";

import { useEffect, useState, type ReactNode } from "react";

// True once the first page has been hydrated; later mounts are navigations inside the app.
let hydrated = false;

/** Rendered once in the layout: tells the fallbacks below that the first load is over. */
export function HydrationMark() {
  useEffect(() => {
    hydrated = true;
  }, []);
  return null;
}

/**
 * The home page shows the guest landing while the session is being checked (so the first load,
 * search engines and link previews get a real page). When a signed-in visitor navigates here from
 * another page that would flash the guest page, so inside the app a loader is shown instead.
 */
export function HomeFallback({ guest, loader }: { guest: ReactNode; loader: ReactNode }) {
  const [inApp] = useState(() => hydrated);
  return inApp ? loader : guest;
}
