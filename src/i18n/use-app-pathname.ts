"use client";

import { usePathname } from "next/navigation";
import { stripLocale } from "./pathname";

/**
 * The address the visitor sees. Pages are served from `/[locale]/…` behind a rewrite (D-088), and
 * `usePathname()` reports that internal path; this puts the plain one back.
 */
export function useAppPathname(): string {
  return stripLocale(usePathname());
}
