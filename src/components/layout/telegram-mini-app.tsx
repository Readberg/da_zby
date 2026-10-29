"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import {
  START_PARAM_PATHS,
  externalLink,
  getWebApp,
  isTelegramHost,
  type TelegramWebApp,
} from "@/lib/telegram-miniapp";
import { localeFromTelegram } from "@/lib/telegram-locale";
import { LOCALE_COOKIE } from "@/i18n/config";
import { saveLocale } from "@/i18n/cookie";
import { useAppPathname } from "@/i18n/use-app-pathname";
import { useLocale } from "@/i18n/client";

const SDK_URL = "https://telegram.org/js/telegram-web-app.js";
// Kept for the tab's life: the launch data is in the address only once, and each step below is
// tried once so a refusal can never turn into a reload loop.
const KEY_INIT = "dazby-tma-init";
const KEY_LOGIN = "dazby-tma-login";
const KEY_LANG = "dazby-tma-lang";
const KEY_START = "dazby-tma-start";

const remembered = (key: string) => {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const remember = (key: string, value = "1") => {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* no storage: the step may repeat after a reload, which is harmless */
  }
};

/** Telegram opens a Mini App with `#tgWebAppData=<signed data>&…` in the address. */
function launchedFromTelegram(): boolean {
  const fromAddress = new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData");
  if (fromAddress) {
    remember(KEY_INIT, fromAddress);
    return true;
  }
  return remembered(KEY_INIT) !== null || getWebApp() !== null;
}

function loadSdk(): Promise<TelegramWebApp | null> {
  const ready = getWebApp();
  if (ready) return Promise.resolve(ready);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve(getWebApp());
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

/**
 * Makes the site a good Telegram Mini App (D-128). It does nothing for an ordinary visitor: the
 * Telegram script is loaded only when the page was opened from Telegram. Inside Telegram it paints
 * the bars in the site's colour, opens the app to full height, signs the visitor in with the signed
 * launch data (no number to pick), shows Telegram's own "Back" button on inner pages, opens outside
 * links through Telegram, takes the language from Telegram on the first visit and follows a
 * `startapp` link to its page.
 */
export function TelegramMiniApp({
  reload = () => window.location.reload(),
}: {
  reload?: () => void;
}) {
  const router = useRouter();
  const pathname = useAppPathname();
  const locale = useLocale();
  const [app, setApp] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    if (!launchedFromTelegram()) return;
    document.documentElement.classList.add("tma");
    let cancelled = false;
    void loadSdk().then((webApp) => {
      if (cancelled || !webApp) return;
      try {
        webApp.ready();
        webApp.expand();
        // The colour of the page, read from the theme (Telegram wants a "#rrggbb" string).
        const color = getComputedStyle(document.documentElement)
          .getPropertyValue("--color-bg")
          .trim();
        if (color) {
          webApp.setHeaderColor?.(color);
          webApp.setBackgroundColor?.(color);
          webApp.setBottomBarColor?.(color);
        }
        // Scrolling the page down must not fold the whole app away.
        webApp.disableVerticalSwipes?.();
      } catch {
        /* an older Telegram without one of these: the rest still works */
      }
      setApp(webApp);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sign in with the launch data, once per tab, if the visitor is not signed in yet.
  useEffect(() => {
    if (!app || remembered(KEY_LOGIN)) return;
    remember(KEY_LOGIN);
    const initData = app.initData || remembered(KEY_INIT) || "";
    api("/me")
      .catch((error: unknown) => {
        if (!(error instanceof ApiClientError) || error.problem.status !== 401) throw error;
        return api("/auth/telegram/miniapp", { method: "POST", json: { initData } }).then(reload);
      })
      .catch(() => {
        /* the usual sign-in through the bot is still there */
      });
  }, [app, reload]);

  // The language of Telegram on the first visit (nothing is chosen on the site yet).
  useEffect(() => {
    if (!app || remembered(KEY_LANG)) return;
    remember(KEY_LANG);
    const code = app.initDataUnsafe?.user?.language_code;
    const chosen = document.cookie.split("; ").some((c) => c.startsWith(`${LOCALE_COOKIE}=`));
    if (!code || chosen) return;
    const wanted = localeFromTelegram(code);
    if (wanted === locale) return;
    saveLocale(wanted);
    reload();
  }, [app, locale, reload]);

  // `t.me/<bot>/<app>?startapp=rating` opens the rating, and so on (a fixed list of pages).
  useEffect(() => {
    if (!app || pathname !== "/" || remembered(KEY_START)) return;
    remember(KEY_START);
    const target = START_PARAM_PATHS[app.initDataUnsafe?.start_param ?? ""];
    if (target) router.replace(target);
  }, [app, pathname, router]);

  // Telegram's own "Back" button instead of the browser's: on every page but the home page.
  useEffect(() => {
    if (!app) return;
    if (pathname === "/") {
      app.BackButton.hide();
      return;
    }
    const back = () => router.back();
    app.BackButton.show();
    app.BackButton.onClick(back);
    return () => app.BackButton.offClick(back);
  }, [app, pathname, router]);

  // A link to another site opens in Telegram's way (a link to t.me stays inside Telegram).
  useEffect(() => {
    if (!app) return;
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = externalLink(link.href, window.location.href);
      if (!url) return;
      event.preventDefault();
      if (isTelegramHost(url.hostname)) app!.openTelegramLink(url.href);
      else app!.openLink(url.href);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [app]);

  return null;
}
