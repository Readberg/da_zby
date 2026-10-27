import { cx } from "@/lib/cx";
import { getMessages } from "@/i18n/server";

export type PredictionResult = "exact" | "outcome" | "miss";

const styles: Record<PredictionResult, string> = {
  // Black on green: white text would fall below WCAG AA contrast.
  exact: "bg-success text-black",
  outcome: "bg-accent text-black",
  miss: "bg-surface text-danger border border-line",
};

/** Prediction result badge; always carries text so the meaning is not conveyed by colour only. */
export function ResultBadge({
  result,
  className,
}: {
  result: PredictionResult;
  className?: string;
}) {
  const t = getMessages();
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-sm font-semibold",
        styles[result],
        className,
      )}
    >
      {t.result[result]}
    </span>
  );
}
