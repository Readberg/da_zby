"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

type Session = "unknown" | "guest" | "member";

// What the home page knows about the visitor. The server part reports it through SessionKnown.
let session: Session = "unknown";
const listeners = new Set<() => void>();

function setSession(next: Session) {
  if (session === next) return;
  session = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Mark of the landing's root: SessionKnown hides it by this mark, GuestSlot finds it in the page. */
const GUEST_MARK = "[data-home-guest]";

/**
 * The guest landing is part of the static shell and is sent once: the first load, search engines
 * and link previews get a real page. Signed-in visitors replace it with the member home: hidden at
 * once by SessionKnown, removed here after hydration. When a signed-in visitor navigates here from
 * another page that would flash the guest page, so inside the app a loader is shown until the
 * session is known. Inside the app is told by the page: on the first load the server-rendered
 * landing is already in the document, after a navigation it is not.
 */
export function GuestSlot({ guest, loader }: { guest: ReactNode; loader: ReactNode }) {
  const [inApp] = useState(
    () => typeof document !== "undefined" && document.querySelector(GUEST_MARK) === null,
  );
  const known = useSyncExternalStore(
    subscribe,
    () => session,
    () => "unknown" as Session,
  );
  useEffect(() => () => setSession("unknown"), []);
  if (known === "member") return null;
  return known === "unknown" && inApp ? loader : guest;
}

/** Rendered by the session check once it is done; for a signed-in visitor it also hides the landing. */
export function SessionKnown({ member }: { member: boolean }) {
  useEffect(() => {
    setSession(member ? "member" : "guest");
    return () => setSession("unknown");
  }, [member]);
  return member ? <style>{`${GUEST_MARK}{display:none}`}</style> : null;
}
