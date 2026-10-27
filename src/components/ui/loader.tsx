"use client";

import { useMessages } from "@/i18n/client";
import { cx } from "@/lib/cx";

/** The site's loading mark: a yellow ring with a black arc that turns; decorative on its own. */
export function BrandSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-accent border-t-ink",
        className,
      )}
    />
  );
}

/** Loading block: the brand spinner centred in a soft surface; size it with classes. */
export function Loader({
  className,
  label,
  showLabel = false,
}: {
  className?: string;
  label?: string;
  showLabel?: boolean;
}) {
  const t = useMessages();
  label ??= t.common.loading;
  return (
    <div
      role="status"
      aria-label={label}
      className={cx(
        "flex flex-col items-center justify-center gap-3 overflow-hidden rounded-lg bg-surface text-muted",
        className,
      )}
    >
      <BrandSpinner />
      {showLabel && <span className="text-sm">{label}</span>}
    </div>
  );
}
