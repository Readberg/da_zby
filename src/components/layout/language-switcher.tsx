"use client";

import { ChevronDownIcon, GlobeIcon } from "@/components/ui/icons";
import { EVENTS, track } from "@/lib/analytics";
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_NAMES,
  isLocale,
} from "@/i18n/config";
import { useLocale, useMessages } from "@/i18n/client";

/**
 * The language of the interface (D-088): the choice is kept in a cookie and the page is loaded
 * again, so every server-rendered text, date and number follows it. The address does not change.
 */
export function LanguageSwitcher({
  reload = () => window.location.reload(),
}: {
  reload?: () => void;
}) {
  const t = useMessages();
  const locale = useLocale();

  function choose(value: string) {
    if (!isLocale(value) || value === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    track(EVENTS.languageChange, { language: value });
    reload();
  }

  return (
    <label className="relative inline-flex min-h-11 w-fit cursor-pointer items-center gap-3 rounded-md border border-line bg-bg px-4 text-ink">
      <GlobeIcon className="h-5 w-5" />
      <select
        aria-label={t.footer.languageLabel}
        value={locale}
        onChange={(event) => choose(event.target.value)}
        className="min-h-11 cursor-pointer appearance-none bg-transparent pr-6"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-4 h-4 w-4" />
    </label>
  );
}
