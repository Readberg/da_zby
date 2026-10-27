"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { EVENTS, track } from "@/lib/analytics";
import { ApiClientError, api } from "@/lib/api-client";
import { LOGIN_NEXT_COOKIE, LOGIN_NEXT_MAX_AGE_SECONDS } from "@/lib/login-next";
import { useMessages } from "@/i18n/client";

type Attempt = {
  token: string;
  code: string;
  appUrl: string;
  webUrl: string;
  expiresAt: number;
};

type Status = "pending" | "confirmed" | "expired";

const STORAGE_KEY = "dazby.telegram-login";
const POLL_MS = 1500;

// The running attempt lives in sessionStorage: a phone may reload this page while the Telegram app
// is in front, and the attempt must survive that. A module variable is the fallback when storage
// is blocked.
let memory: string | null = null;
const listeners = new Set<() => void>();

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return memory;
  }
}

function writeStored(value: string | null) {
  memory = value;
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, value);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Blocked storage: the in-memory copy above is used.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function parseAttempt(raw: string | null): Attempt | null {
  if (!raw) return null;
  try {
    const attempt = JSON.parse(raw) as Attempt;
    return attempt.expiresAt > Date.now() ? attempt : null;
  } catch {
    return null;
  }
}

function PlaneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M21.9 4.3 18.7 19.6c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.6 13 1.9 11.5c-1-.3-1-1 .2-1.5L20.4 2.9c.9-.3 1.6.2 1.5 1.4Z" />
    </svg>
  );
}

/**
 * Sign-in through the Telegram bot. The site creates a one-time attempt and opens the bot in the
 * Telegram app; the visitor presses Start and picks the number shown here, and this page — which
 * keeps asking the server — continues by itself. It uses whichever Telegram account is active in
 * the app, so switching accounts there just works. The return path travels in a short-lived cookie.
 */
export function TelegramLogin({
  next,
  error,
  navigate = (url) => window.location.assign(url),
}: {
  next: string;
  error?: string | null;
  navigate?: (url: string) => void;
}) {
  const t = useMessages();
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  const attempt = useMemo(() => parseAttempt(stored), [stored]);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const finished = useRef(false);

  const reset = useCallback((text: string | null) => {
    writeStored(null);
    setMessage(text);
  }, []);

  const token = attempt?.token;
  const expiredText = t.auth.errors.expired;
  useEffect(() => {
    if (!token) return;
    finished.current = false;

    async function poll() {
      if (finished.current) return;
      try {
        const { status } = await api<{ status: Status }>(
          `/auth/telegram/status?token=${encodeURIComponent(token!)}`,
        );
        if (finished.current) return;
        if (status === "confirmed") {
          finished.current = true;
          track(EVENTS.loginConfirmed);
          navigate(`/auth/telegram?token=${encodeURIComponent(token!)}`);
        } else if (status === "expired") {
          finished.current = true;
          track(EVENTS.loginFailed, { reason: "expired" });
          reset(expiredText);
        }
      } catch {
        // A short network hiccup: the next tick tries again.
      }
    }

    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      finished.current = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, navigate, reset, expiredText]);

  async function start() {
    if (starting) return;
    setStarting(true);
    setMessage(null);
    document.cookie = `${LOGIN_NEXT_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${LOGIN_NEXT_MAX_AGE_SECONDS}; samesite=lax`;
    try {
      const created = await api<Omit<Attempt, "expiresAt"> & { expiresInSeconds: number }>(
        "/auth/telegram/start",
        { method: "POST" },
      );
      const fresh: Attempt = {
        token: created.token,
        code: created.code,
        appUrl: created.appUrl,
        webUrl: created.webUrl,
        expiresAt: Date.now() + created.expiresInSeconds * 1000,
      };
      writeStored(JSON.stringify(fresh));
      track(EVENTS.loginCodeShown);
      // Opens the Telegram app directly; without the app nothing happens and the links below work.
      window.location.href = fresh.appUrl;
    } catch (cause) {
      const unavailable = cause instanceof ApiClientError && cause.problem.status === 503;
      track(EVENTS.loginFailed, { reason: unavailable ? "unavailable" : "start" });
      setMessage(unavailable ? t.auth.unavailable : t.auth.errors.start);
    } finally {
      setStarting(false);
    }
  }

  if (attempt) {
    return (
      <div className="flex w-full flex-col gap-4">
        <p className="text-muted">{t.auth.codeIntro}</p>
        <p
          aria-label={`${t.auth.codeLabel}: ${attempt.code}`}
          className="font-display text-h1 leading-none tracking-wide"
        >
          {attempt.code}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={attempt.appUrl}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-telegram px-7 text-base font-semibold text-white transition hover:brightness-95 active:scale-[0.97]"
          >
            <PlaneIcon />
            {t.auth.openTelegram}
          </a>
          <Button variant="text" onClick={() => reset(null)}>
            {t.auth.cancel}
          </Button>
        </div>
        <p className="text-sm text-muted">
          {t.auth.noApp}{" "}
          <a href={attempt.webUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {t.auth.openInBrowser}
          </a>
        </p>
        <p role="status" className="flex items-center gap-2 text-sm text-muted">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          {t.auth.waiting}
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Button
        type="button"
        onClick={start}
        loading={starting}
        className="min-h-14 w-full bg-telegram px-7 text-lg text-white hover:brightness-95"
      >
        {!starting && <PlaneIcon />}
        {t.auth.telegram}
      </Button>
      <p id="login-error" role="alert" className="min-h-5 text-sm text-danger">
        {message ?? error}
      </p>
    </div>
  );
}
