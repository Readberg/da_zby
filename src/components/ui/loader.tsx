import { cx } from "@/lib/cx";
import { ru } from "@/messages/ru";

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
  label = ru.common.loading,
  showLabel = false,
}: {
  className?: string;
  label?: string;
  showLabel?: boolean;
}) {
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
