"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LOGIN_NEXT_COOKIE, LOGIN_NEXT_MAX_AGE_SECONDS } from "@/lib/login-next";
import { ru } from "@/messages/ru";

const WIDGET_SRC = "https://telegram.org/js/telegram-widget.js?22";

type TelegramWidgetUser = Record<string, string | number>;

type TelegramGlobal = {
  Login?: {
    auth: (
      options: { bot_id: number; request_access?: boolean | string; lang?: string },
      callback: (user: TelegramWidgetUser | false) => void,
    ) => void;
  };
};

/** The signed fields go to the server as they are: the signature covers exactly what Telegram sent. */
export function telegramAuthUrl(user: TelegramWidgetUser): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(user)) params.set(key, String(value));
  return `/auth/telegram?${params.toString()}`;
}

function loadWidgetScript(): Promise<void> {
  if ((window as unknown as { Telegram?: TelegramGlobal }).Telegram?.Login) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("telegram widget failed to load"));
    document.head.appendChild(script);
  });
}

function PlaneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M21.9 4.3 18.7 19.6c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.6 13 1.9 11.5c-1-.3-1-1 .2-1.5L20.4 2.9c.9-.3 1.6.2 1.5 1.4Z" />
    </svg>
  );
}

/**
 * Own "Войти через Telegram" button that opens Telegram's login window (the official widget
 * script is only used for its `Telegram.Login.auth` call). After the visitor confirms in
 * Telegram the page continues to /auth/telegram by itself; the return path travels in a
 * short-lived cookie.
 */
export function TelegramLogin({
  botId,
  next,
  error,
  navigate = (url) => window.location.assign(url),
}: {
  /** Numeric id of the login bot (the digits before the colon in its token; not a secret). */
  botId: number | null;
  next: string;
  error?: string | null;
  navigate?: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (botId) void loadWidgetScript().catch(() => undefined);
  }, [botId]);

  async function onClick() {
    if (!botId || busy) return;
    setFailed(false);
    setBusy(true);
    document.cookie = `${LOGIN_NEXT_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${LOGIN_NEXT_MAX_AGE_SECONDS}; samesite=lax`;
    try {
      await loadWidgetScript();
      const login = (window as unknown as { Telegram?: TelegramGlobal }).Telegram?.Login;
      if (!login) throw new Error("no widget");
      login.auth({ bot_id: botId, request_access: "write", lang: "ru" }, (user) => {
        if (!user) {
          setBusy(false);
          return;
        }
        navigate(telegramAuthUrl(user));
      });
    } catch {
      setBusy(false);
      setFailed(true);
    }
  }

  const message = failed ? ru.auth.errors.telegramScript : error;

  return (
    <div className="flex max-w-md flex-col gap-3">
      {botId ? (
        <Button
          type="button"
          onClick={onClick}
          loading={busy}
          className="bg-telegram px-7 text-white hover:brightness-95"
        >
          {!busy && <PlaneIcon />}
          {busy ? ru.auth.waiting : ru.auth.telegram}
        </Button>
      ) : (
        <p className="text-muted">{ru.auth.unavailable}</p>
      )}
      <p id="login-error" role="alert" className="min-h-5 text-sm text-danger">
        {message}
      </p>
    </div>
  );
}
