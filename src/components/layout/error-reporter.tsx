"use client";

import { useEffect } from "react";
import { EVENTS, safePath, shortMessage, track } from "@/lib/analytics";

const MAX_REPORTS_PER_PAGE = 5;

/**
 * Reports errors that happen in the visitor's browser to Umami as a "client-error" event: a short
 * message and the page path, nothing else. Repeats are dropped and a page sends only a few, so one
 * broken screen cannot flood the stats (D-079).
 */
export function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    function report(raw: unknown) {
      const message = shortMessage(raw instanceof Error ? raw.message : String(raw ?? "unknown"));
      // Errors of other people's scripts reach the page without any detail: nothing to act on.
      if (message === "Script error." || seen.has(message) || seen.size >= MAX_REPORTS_PER_PAGE)
        return;
      seen.add(message);
      track(EVENTS.clientError, {
        message,
        path: safePath(window.location.pathname),
      });
    }
    const onError = (event: ErrorEvent) => report(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => report(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
