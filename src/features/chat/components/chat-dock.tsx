"use client";

import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChatIcon, CloseIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import type { ProfileMe } from "@/server/api/v1/schemas/profile";
import type { ChatList } from "@/server/api/v1/schemas/chat";
import { useAppPathname } from "@/i18n/use-app-pathname";
import { useMessages } from "@/i18n/client";

// The chat itself (with the Realtime client, ~200 KB) is loaded only when the window is opened.
const ChatView = lazy(() => import("./chat-view").then((m) => ({ default: m.ChatView })));

const STORAGE_KEY = "dazby-chat-open";

// The choice lives in the browser: it survives reloads and visits, each device has its own.
// Without storage (private window) it still holds until the tab is closed.
let memory = false;
const listeners = new Set<() => void>();

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return memory;
  }
}

function writeOpen(open: boolean) {
  memory = open;
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {
    /* keep the in-memory value */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

type Loaded = { list: ChatList; utcOffsetMinutes: number };

function DockBody({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const t = useMessages().chat;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<ChatList>("/chat"), api<ProfileMe>("/me")])
      .then(([list, me]) => {
        if (!cancelled) setLoaded({ list, utcOffsetMinutes: me.utcOffsetMinutes });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <p role="alert" className="p-4 text-sm text-danger">
        {t.errors.loadFailed}
      </p>
    );
  }
  if (!loaded) return <Skeleton className="m-3 h-full" />;
  return (
    <Suspense fallback={<Skeleton className="m-3 h-full" />}>
      <ChatView
        variant="dock"
        initial={loaded.list}
        currentUserId={userId}
        isAdmin={isAdmin}
        utcOffsetMinutes={loaded.utcOffsetMinutes}
      />
    </Suspense>
  );
}

/**
 * The common chat as a window in the bottom-right corner of every page, for signed-in members on
 * wide screens (on a phone the menu leads to the /chat page). Closed by default; the visitor's
 * choice is remembered, so a window left open is open on the next visit (DAZBY-120).
 */
export function ChatDock({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const t = useMessages().chat;
  const pathname = useAppPathname();
  const open = useSyncExternalStore(subscribe, readOpen, () => false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  // The /chat page is the same chat in full; two copies on one screen would only confuse.
  const onChatPage = pathname === "/chat" || pathname.startsWith("/chat/");

  // Escape folds the window up from anywhere on the page while it is open.
  useEffect(() => {
    if (!open || onChatPage) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      writeOpen(false);
      // The window is gone after this render; the round button takes the focus.
      requestAnimationFrame(() => toggleRef.current?.focus());
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onChatPage]);

  if (onChatPage) return null;

  return (
    <div className="hidden lg:block">
      {open ? (
        <section
          id="chat-dock"
          aria-label={t.dockLabel}
          ref={panelRef}
          tabIndex={-1}
          className="fixed bottom-6 right-6 z-40 flex h-[min(34rem,calc(100vh-3rem))] outline-none w-88 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-soft"
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-2">
            <h2 className="font-display text-lg uppercase">{t.title}</h2>
            <button
              type="button"
              onClick={() => writeOpen(false)}
              aria-label={t.closeLabel}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-line/60"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 p-3">
            <DockBody userId={userId} isAdmin={isAdmin} />
          </div>
        </section>
      ) : (
        <button
          ref={toggleRef}
          type="button"
          onClick={() => {
            writeOpen(true);
            // Whoever opened it by keyboard continues inside the window.
            requestAnimationFrame(() => panelRef.current?.focus());
          }}
          aria-expanded="false"
          aria-controls="chat-dock"
          aria-label={t.openLabel}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-accent text-black shadow-soft ring-4 ring-accent/30 transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          <ChatIcon className="h-7 w-7" />
        </button>
      )}
    </div>
  );
}
