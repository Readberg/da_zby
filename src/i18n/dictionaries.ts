import { en } from "@/messages/en";
import { ru } from "@/messages/ru";
import type { MessagesShape } from "@/messages/types";
import type { Locale } from "./config";

/** The texts of one language; both languages have exactly this shape. */
export type Dictionary = MessagesShape<typeof ru>;

export const dictionaries: Record<Locale, Dictionary> = { ru, en };

/**
 * Sections that client components read through `useMessages()`. Only these travel to the browser
 * (inside the page, twice in the stream): the landing page, the admin area and the rest are used by
 * server components only. The type below is narrowed to the same list, so reading any other section
 * in a client component does not compile (DAZBY-114).
 */
export const CLIENT_SECTIONS = [
  "common",
  "theme",
  "footer",
  "notFound",
  "error",
  "auth",
  "predictions",
  "avatar",
  "onboarding",
  "profile",
  "rating",
  "home",
] as const;

export type ClientDictionary = Pick<Dictionary, (typeof CLIENT_SECTIONS)[number]>;

export function clientDictionary(locale: Locale): ClientDictionary {
  const dictionary = dictionaries[locale];
  return Object.fromEntries(
    CLIENT_SECTIONS.map((section) => [section, dictionary[section]]),
  ) as ClientDictionary;
}
