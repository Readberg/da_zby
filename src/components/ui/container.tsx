import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

/** Centred page column: 16 px side padding on phones, at most 1200 px wide. */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("mx-auto w-full max-w-site px-4 sm:px-8 lg:px-12", className)} {...props} />
  );
}
