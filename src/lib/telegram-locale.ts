import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

/**
 * Telegram's own language setting, used only when the site language is not known yet (the bot's
 * messages without a live attempt, the first visit inside the Mini App).
 */
export function localeFromTelegram(languageCode: string | undefined): Locale {
  if (!languageCode) return DEFAULT_LOCALE;
  return /^(ru|be|uk|kk)(-|$)/i.test(languageCode) ? "ru" : "en";
}
