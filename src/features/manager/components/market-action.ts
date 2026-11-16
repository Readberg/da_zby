import { ApiClientError } from "@/lib/api-client";

/** The text for the code of a problem of the market API; the generic one for anything else. */
export function problemText(
  cause: unknown,
  texts: Record<string, string>,
  generic: string,
): string {
  const code = cause instanceof ApiClientError ? cause.problem.code : null;
  return (code && texts[code]) || generic;
}
