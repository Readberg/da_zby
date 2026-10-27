import { en } from "@/messages/en";
import { ru } from "@/messages/ru";
import type { MessagesShape } from "@/messages/types";
import type { Locale } from "./config";

/** The texts of one language; both languages have exactly this shape. */
export type Dictionary = MessagesShape<typeof ru>;

export const dictionaries: Record<Locale, Dictionary> = { ru, en };

/** The dictionary without the admin section, which is Russian only and never reaches the browser. */
export type ClientDictionary = Omit<Dictionary, "admin">;

export function clientDictionary(locale: Locale): ClientDictionary {
  const { admin: _admin, ...rest } = dictionaries[locale];
  void _admin;
  return rest;
}
