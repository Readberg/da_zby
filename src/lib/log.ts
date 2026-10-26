/**
 * Structured server log (D-079): one JSON object per line, so the Railway log can be searched and
 * filtered by `event`, `requestId` or `route`. Never put tokens, e-mails or request bodies in it.
 */
export type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** The error as log fields: its kind, a short message and the first lines of the stack. */
export function errorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      error: error.name,
      message: error.message.slice(0, 300),
      stack: error.stack?.split("\n").slice(0, 6).join("\n"),
      ...digestOf(error),
    };
  }
  return { error: typeof error, message: String(error).slice(0, 300) };
}

/** Next.js puts a `digest` on errors it hides from the browser; the browser report carries it too. */
function digestOf(error: Error): { digest?: string } {
  const digest = (error as Error & { digest?: unknown }).digest;
  return typeof digest === "string" ? { digest } : {};
}
