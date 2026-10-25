"use client";

import { useEffect, useRef } from "react";
import { LOGIN_NEXT_COOKIE, LOGIN_NEXT_MAX_AGE_SECONDS } from "@/lib/login-next";
import { ru } from "@/messages/ru";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
const BOT_PATTERN = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

/**
 * Telegram Login Widget in redirect mode: after the tap Telegram sends the browser to
 * /auth/telegram with signed data. The return path travels in a short-lived cookie because
 * Telegram controls the query string of that redirect.
 */
export function TelegramLogin({ next, error }: { next: string; error?: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const configured = BOT_PATTERN.test(BOT_USERNAME);

  useEffect(() => {
    if (!configured || !container.current) return;
    const host = container.current;
    document.cookie = `${LOGIN_NEXT_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${LOGIN_NEXT_MAX_AGE_SECONDS}; samesite=lax`;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.dataset.telegramLogin = BOT_USERNAME;
    script.dataset.size = "large";
    script.dataset.radius = "8";
    script.dataset.authUrl = `${window.location.origin}/auth/telegram`;
    script.dataset.requestAccess = "write";
    host.appendChild(script);
    return () => {
      host.replaceChildren();
    };
  }, [configured, next]);

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
