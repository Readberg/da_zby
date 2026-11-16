"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ru } from "@/messages/ru";

type Value = { t: Dictionary["manager"]; locale: Locale };

// Without a provider (unit tests, isolated components) the texts are Russian.
const Context = createContext<Value>({ t: ru.manager, locale: DEFAULT_LOCALE });

/**
 * The texts of the football manager for the client components of its pages (the layout of the
 * section wraps them). Only the manager pages get them: the rest of the site does not carry them.
 */
export function ManagerProvider({ t, locale, children }: Value & { children: ReactNode }) {
  return <Context.Provider value={{ t, locale }}>{children}</Context.Provider>;
}

export function useManager(): Value {
  return useContext(Context);
}
