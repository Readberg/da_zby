/**
 * Product events for Umami (D-079). Umami counts visitors without cookies; events carry no names,
 * ids or addresses with parameters: only what happened and a coarse detail. Every call is safe:
 * where Umami is not loaded (local, blocked, offline) nothing happens.
 */
export const EVENTS = {
  /** A click on a call to action; `where` says which one (data attributes on links, see ANALYTICS.md). */
  ctaClick: "cta-click",
  /** The code to pick in the Telegram bot was shown to the visitor. */
  loginCodeShown: "login-code-shown",
  /** The visitor picked the code in the bot: the sign-in is confirmed. */
  loginConfirmed: "login-confirmed",
  /** The sign-in could not start or expired; `reason` tells which. */
  loginFailed: "login-failed",
  /** A new participant chose a nickname: the account is ready. */
  nicknameSaved: "nickname-saved",
  /** Predictions were saved; `count` matches. */
  predictionSaved: "prediction-saved",
  /** Saving predictions failed or was refused; `reason` tells which. */
  predictionFailed: "prediction-failed",
  /** A question on the landing was opened; `question` is its number. */
  faqOpen: "faq-open",
  /** The theme was switched by hand; `theme` is the new one. */
  themeChange: "theme-change",
  /** An error in the browser (see ErrorReporter); `message` is short and has no personal data. */
  clientError: "client-error",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
export type EventData = Record<string, string | number | boolean>;

type UmamiWindow = { umami?: { track?: (name: string, data?: EventData) => void } };

export function track(name: EventName, data?: EventData): void {
  if (typeof window === "undefined") return;
  try {
    (window as unknown as UmamiWindow).umami?.track?.(name, data);
  } catch {
    // Analytics must never break the page.
  }
}

/** The path without the query string or the hash: addresses can carry tokens. */
export function safePath(href: string): string {
  return href.split(/[?#]/)[0] ?? "";
}

/** A short single line for an error report. */
export function shortMessage(message: string, max = 120): string {
  const line = message.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
