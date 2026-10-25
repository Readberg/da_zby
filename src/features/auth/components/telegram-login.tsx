"use client";

import { useEffect, useRef } from "react";
import { LOGIN_NEXT_COOKIE, LOGIN_NEXT_MAX_AGE_SECONDS } from "@/lib/login-next";
import { ru } from "@/messages/ru";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
const BOT_PATTERN = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const CALLBACK = "dazbyTelegramAuth";

type TelegramWidgetUser = Record<string, string | number>;

/** The signed fields go to the server as they are: the signature covers exactly what Telegram sent. */
export function telegramAuthUrl(user: TelegramWidgetUser): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(user)) params.set(key, String(value));
  return `/auth/telegram?${params.toString()}`;
}

/**
 * Telegram Login Widget with a JS callback: once the visitor confirms in Telegram the page
 * continues to /auth/telegram by itself, without a second tap. The return path travels in a
 * short-lived cookie.
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
  const container = useRef<HTMLDivElement>(null);
  const configured = BOT_PATTERN.test(BOT_USERNAME);

  useEffect(() => {
    if (!configured || !container.current) return;
    const host = container.current;
    document.cookie = `${LOGIN_NEXT_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${LOGIN_NEXT_MAX_AGE_SECONDS}; samesite=lax`;

    const callbacks = window as unknown as Record<string, unknown>;
    callbacks[CALLBACK] = (user: TelegramWidgetUser) => navigate(telegramAuthUrl(user));

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.dataset.telegramLogin = BOT_USERNAME;
    script.dataset.size = "large";
    script.dataset.radius = "8";
    script.dataset.onauth = `${CALLBACK}(user)`;
    script.dataset.requestAccess = "write";
    host.appendChild(script);
    return () => {
      host.replaceChildren();
      delete callbacks[CALLBACK];
    };
  }, [configured, next, navigate]);

  return (
    <div className="flex max-w-md flex-col gap-3">
      {configured ? (
        <div ref={container} className="min-h-10" />
      ) : (
        <p className="text-muted">{ru.auth.unavailable}</p>
      )}
      <p id="login-error" role="alert" className="min-h-5 text-sm text-danger">
        {error}
      </p>
    </div>
  );
}
