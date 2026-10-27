"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ru } from "@/messages/ru";
import { DEFAULT_LOCALE, type Locale } from "./config";
import type { ClientDictionary } from "./dictionaries";

type Value = { locale: Locale; messages: ClientDictionary };

// Without a provider (unit tests, isolated components) the texts are Russian.
const Context = createContext<Value>({ locale: DEFAULT_LOCALE, messages: ru });

/** Gives client components the texts of the page's language (the layout wraps the whole page). */
export function MessagesProvider({ locale, messages, children }: Value & { children: ReactNode }) {
  return <Context.Provider value={{ locale, messages }}>{children}</Context.Provider>;
}

export function useMessages(): ClientDictionary {
  return useContext(Context).messages;
}

export function useLocale(): Locale {
  return useContext(Context).locale;
}
