import { cx } from "@/lib/cx";
import { ru } from "@/messages/ru";

/** Loading placeholder; size it with classes (`h-6 w-40`, `aspect-video`, …). */
export function Skeleton({
  className,
  label = ru.common.loading,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cx("animate-pulse rounded-md bg-line", className)}
    />
  );
}
