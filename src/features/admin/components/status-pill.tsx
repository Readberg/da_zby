import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Small status pill (season state etc.); always carries text, colour is only a hint. */
export function StatusPill({ tone, children }: { tone: "ok" | "muted"; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-sm px-3 py-0.5 text-sm font-semibold",
        tone === "ok" ? "bg-accent text-black" : "border border-line text-muted",
      )}
    >
      {children}
    </span>
  );
}
