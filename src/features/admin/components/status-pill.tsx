import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Small status pill (season state etc.); always carries text, colour is only a hint. */
export function StatusPill({ tone, children }: { tone: "ok" | "muted"; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-0.5 text-sm font-medium",
        tone === "ok" ? "bg-accent text-ink" : "bg-surface text-muted",
      )}
    >
      {children}
    </span>
  );
}
