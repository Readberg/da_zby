import { isLocale } from "./config";

/** "/en/rating" → "/rating", "/ru" → "/"; any other path is returned as it is. */
export function stripLocale(pathname: string): string {
  const [, first = "", ...rest] = pathname.split("/");
  if (!isLocale(first)) return pathname;
  return rest.length === 0 ? "/" : `/${rest.join("/")}`;
}
