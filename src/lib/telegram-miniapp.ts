/** The part of `Telegram.WebApp` that the site uses (https://core.telegram.org/bots/webapps). */
export type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: { user?: { language_code?: string }; start_param?: string };
  version?: string;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  HapticFeedback?: {
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** The Mini App object, when the page runs inside Telegram and its script has loaded. */
export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : null;
}

/** A short vibration on a success or a failure; nothing happens outside Telegram. */
export function tmaHaptic(type: "error" | "success" | "warning"): void {
  try {
    getWebApp()?.HapticFeedback?.notificationOccurred(type);
  } catch {
    /* a missing vibration is not worth an error */
  }
}

/** The pages that a `startapp` link may open (`t.me/<bot>/<app>?startapp=rating`). */
export const START_PARAM_PATHS: Record<string, string> = {
  predictions: "/predictions",
  rating: "/rating",
  standings: "/standings",
  chat: "/chat",
  profile: "/profile",
  support: "/support",
};

/** Only an address outside the site is handed to Telegram: it opens in the right place. */
export function externalLink(href: string, base: string): URL | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  return url.origin === new URL(base).origin ? null : url;
}

export const isTelegramHost = (hostname: string) => /^(t|telegram)\.me$/i.test(hostname);
