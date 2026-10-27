"use client";

import { EVENTS, track } from "@/lib/analytics";
import { effectiveTheme, otherTheme, THEME_STORAGE_KEY } from "@/lib/theme";
import { useMessages } from "@/i18n/client";

/** Switches between the light and the dark theme and remembers the choice on this device. */
export function ThemeToggle() {
  const t = useMessages();
  function toggle() {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = otherTheme(effectiveTheme(root, prefersDark));
    root.setAttribute("data-theme", next);
    track(EVENTS.themeChange, { theme: next });
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode: the choice just lasts until the page is closed.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.theme.toggle}
      title={t.theme.toggle}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors duration-200 hover:bg-surface"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="theme-moon h-5 w-5 fill-current">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="theme-sun h-5 w-5 fill-current">
        <circle cx="12" cy="12" r="4.5" />
        <path
          d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </button>
  );
}
